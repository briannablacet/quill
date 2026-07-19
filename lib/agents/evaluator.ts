import { generateObject } from "ai"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import type { ContentDoc } from "./writer"
import { SCORECARD_SYSTEM, buildScorecardPrompt, scorecardSchema } from "./prompts/content-scorecard"
import { LANDING_PAGE_SCORECARD_SYSTEM, buildLandingPageScorecardPrompt } from "./prompts/landing-page-scorecard"
import { CASE_STUDY_SCORECARD_SYSTEM, buildCaseStudyScorecardPrompt } from "./prompts/case-study-scorecard"
import { getBrandProfile } from "./brand-profile"

// ---------------------------------------------------------------------------
// Evaluator agent — score_content task handler (Content Quality Scorecard).
// See migration.md §4 (Evaluator agent) and §5 Phase 2.
//
// Criteria are mode-aware: a landing page and a case study are judged
// against their own real format/factual requirements, not blog_post's
// article-specific rules. All modes share one output schema (scorecardSchema)
// so the rest of the system (orchestrator, ContentDoc) doesn't need to care
// which mode produced the grade.
// ---------------------------------------------------------------------------

type ScoreContentPayload = {
  contentId: string
}

// Real brand rules when a profile exists (migration.md §5 Phase 5 retrieval
// layer) — kept to a bounded, high-signal subset (avoid-phrases + core style
// points) rather than dumping the entire terminology/customRules list into
// every grading prompt.
export async function getBrandRules(userId: string): Promise<string[] | undefined> {
  const profile = await getBrandProfile(userId)
  if (!profile) return undefined
  return [
    ...profile.voice.avoidPhrases.map((p) => `Must not use: "${p}"`),
    ...profile.voice.stylePoints.slice(0, 5),
    ...(profile.styleRules.oxfordComma ? ["Uses the Oxford comma consistently"] : []),
  ]
}

async function buildScorecardCall(content: ContentDoc): Promise<{ system: string; prompt: string }> {
  const brandRules = await getBrandRules(content.userId)

  if (content.mode === "landing_page") {
    const callToAction = content.meta?.callToAction ?? ""
    return {
      system: LANDING_PAGE_SCORECARD_SYSTEM,
      prompt: buildLandingPageScorecardPrompt(content.topic, content.body, callToAction, brandRules),
    }
  }
  if (content.mode === "case_study") {
    const sourceFacts = content.meta?.sourceFacts ?? ""
    return {
      system: CASE_STUDY_SCORECARD_SYSTEM,
      prompt: buildCaseStudyScorecardPrompt(content.topic, content.body, sourceFacts, brandRules),
    }
  }
  // Default: blog_post's article criteria.
  return {
    system: SCORECARD_SYSTEM,
    prompt: buildScorecardPrompt(content.topic, content.body, brandRules),
  }
}

export async function scoreContent(task: TaskDoc): Promise<Record<string, unknown>> {
  const { contentId } = task.payload as ScoreContentPayload

  if (!contentId || typeof contentId !== "string") {
    throw new Error("score_content task requires a non-empty 'contentId' in payload")
  }

  const db = await getDb()
  const contentCollection = db.collection<ContentDoc>("content")
  const content = await contentCollection.findOne({ contentId })

  if (!content) {
    throw new Error(`No content document found for contentId: ${contentId}`)
  }

  const { system, prompt } = await buildScorecardCall(content)

  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-5",
    schema: scorecardSchema,
    system,
    prompt,
    temperature: 0.2,
  })

  const scoredAt = new Date()

  await contentCollection.updateOne(
    { contentId },
    {
      $set: {
        grade: object.grade,
        score: object.score,
        breakdown: object.breakdown,
        fixGuidance: object.fixGuidance,
        styleNotes: object.styleNotes ?? [],
        scoredAt,
        updatedAt: scoredAt,
      },
    }
  )

  return { contentId, grade: object.grade, score: object.score }
}
