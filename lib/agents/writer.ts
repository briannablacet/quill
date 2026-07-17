import { randomUUID } from "crypto"
import { generateText, generateObject } from "ai"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import { BLOG_POST_SYSTEM, buildBlogPostPrompt, type BlogPostBrief } from "./prompts/blog-post"
import { TAGLINE_SYSTEM, buildTaglinePrompt, parseTaglines, type TaglineBrief } from "./prompts/taglines"
import { socialMediaSchema, buildSocialMediaSystem, buildSocialMediaPrompt, platformSpec, type SocialMediaBrief } from "./prompts/social-media"
import { LANDING_PAGE_SYSTEM, buildLandingPagePrompt, type LandingPageBrief } from "./prompts/landing-page"
import { CASE_STUDY_SYSTEM, CASE_STUDY_TEMPERATURE, buildCaseStudyPrompt, type CaseStudyBrief } from "./prompts/case-study"
import { BATTLECARD_SYSTEM, buildBattlecardPrompt, type BattlecardBrief } from "./prompts/battlecard"
import { resolveCompetitorTarget } from "./competitive-intel"
import { fetchPageText } from "./serper"

// ---------------------------------------------------------------------------
// Writer agent — generate_content task handler.
// See migration.md §4 (Writer agent) and §5 Phase 1/3.
// ---------------------------------------------------------------------------

export type ContentMode = "blog_post" | "taglines" | "social_media" | "landing_page" | "case_study" | "battlecard"

export type ScorecardBreakdownItem = {
  criterion: string
  met: boolean
  note: string
}

export type ContentDoc = {
  _id?: string
  contentId: string
  userId: string
  mode: ContentMode
  topic: string
  body: string
  // Set instead of (or alongside) body for list-shaped modes like taglines.
  items?: string[]
  // Persisted for blog_post so the orchestrator can fold fix guidance into a
  // regeneration request (migration.md §5 Phase 4) without losing the
  // original ask.
  brief?: string
  // Set when this draft is an orchestrator-triggered rewrite of a lower-
  // scoring earlier draft.
  regeneratedFrom?: string
  // Mode-specific structured context the evaluator needs at scoring time
  // (e.g. landing_page's exact CTA text, case_study's source facts) that
  // doesn't fit the generic topic/brief/body shape.
  meta?: Record<string, string>
  status: "draft" | "published" | "archived"
  sourceTaskId: string
  // Populated by the evaluator agent's score_content task (migration.md §5 Phase 2).
  // Absent until scoring runs.
  grade?: "A" | "B" | "C" | "D" | "F"
  score?: number
  breakdown?: ScorecardBreakdownItem[]
  fixGuidance?: string[]
  scoredAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Adding a new content mode = one entry here + one prompt file. This is the
// extraction point migration.md §5 Phase 3 grows: one Skribil mode at a time.

type BattlecardPayload = {
  competitor: string // name or URL, resolved the same way as fetch_competitor_content
  positioning: string
  ourAdvantages?: string
  tone?: string
  style?: string
  mood?: string
}

type GenerateContentPayload =
  | (BlogPostBrief & { mode?: "blog_post"; regeneratedFrom?: string })
  | (TaglineBrief & { mode: "taglines" })
  | (SocialMediaBrief & { mode: "social_media" })
  | (LandingPageBrief & { mode: "landing_page" })
  | (CaseStudyBrief & { mode: "case_study" })
  | (BattlecardPayload & { mode: "battlecard" })

export async function generateContent(task: TaskDoc): Promise<Record<string, unknown>> {
  const payload = task.payload as GenerateContentPayload
  const mode: ContentMode = payload.mode ?? "blog_post"

  let topic: string
  let body: string
  let items: string[] | undefined
  let brief: string | undefined
  let regeneratedFrom: string | undefined
  let meta: Record<string, string> | undefined

  if (mode === "blog_post") {
    const { topic: t, regeneratedFrom: regenFrom, ...rest } = payload as BlogPostBrief & { regeneratedFrom?: string }
    if (!t || typeof t !== "string") {
      throw new Error("blog_post mode requires a non-empty 'topic' in payload")
    }
    topic = t
    brief = rest.brief
    regeneratedFrom = regenFrom

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      system: BLOG_POST_SYSTEM,
      prompt: buildBlogPostPrompt({ topic, ...rest }),
      maxOutputTokens: 4000,
      temperature: 0.3,
    })
    body = text
  } else if (mode === "taglines") {
    const { businessName, description, numOptions } = payload as TaglineBrief
    if (!businessName || !description) {
      throw new Error("taglines mode requires 'businessName' and 'description' in payload")
    }
    topic = businessName

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      system: TAGLINE_SYSTEM,
      prompt: buildTaglinePrompt({ businessName, description }),
      maxOutputTokens: 2000,
      temperature: 0.7,
    })
    items = parseTaglines(text, numOptions)
    body = items.map((line, i) => `${i + 1}. ${line}`).join("\n")
  } else if (mode === "social_media") {
    const socialInput = payload as SocialMediaBrief
    if (!socialInput.content || typeof socialInput.content !== "string") {
      throw new Error("social_media mode requires non-empty 'content' in payload")
    }
    const platform = socialInput.platform ?? "linkedin"
    topic = `${platform} post`

    const { object } = await generateObject({
      model: "anthropic/claude-sonnet-5",
      schema: socialMediaSchema,
      system: buildSocialMediaSystem(platform),
      prompt: buildSocialMediaPrompt(socialInput),
      maxOutputTokens: platformSpec(platform).maxOutputTokens,
      temperature: 0.8,
    })
    items = object
    body = items.map((line, i) => `${i + 1}. ${line}`).join("\n\n")
  } else if (mode === "landing_page") {
    const landingInput = payload as LandingPageBrief
    if (!landingInput.title || !landingInput.callToAction) {
      throw new Error("landing_page mode requires 'title' and 'callToAction' in payload")
    }
    topic = landingInput.title
    meta = { callToAction: landingInput.callToAction }

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      system: LANDING_PAGE_SYSTEM,
      prompt: buildLandingPagePrompt(landingInput),
      maxOutputTokens: 2000,
      temperature: 0.3,
    })
    body = text
  } else if (mode === "case_study") {
    const caseInput = payload as CaseStudyBrief
    if (!caseInput.customerName || !caseInput.problem || !caseInput.solution || !caseInput.results) {
      throw new Error("case_study mode requires 'customerName', 'problem', 'solution', and 'results' in payload")
    }
    topic = `${caseInput.customerName} case study`
    meta = {
      sourceFacts: [
        `Customer: ${caseInput.customerName}`,
        `Role: ${caseInput.customerRole}`,
        caseInput.company ? `Company: ${caseInput.company}` : "",
        `Problem: ${caseInput.problem}`,
        `Solution: ${caseInput.solution}`,
        `Results: ${caseInput.results}`,
        caseInput.quote ? `Quote: "${caseInput.quote}"${caseInput.quoteSpeaker ? ` — ${caseInput.quoteSpeaker}` : ""}` : "",
      ].filter(Boolean).join("\n"),
    }

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      system: CASE_STUDY_SYSTEM,
      prompt: buildCaseStudyPrompt(caseInput),
      maxOutputTokens: 2000,
      temperature: CASE_STUDY_TEMPERATURE,
    })
    body = text
  } else if (mode === "battlecard") {
    const battlecardInput = payload as BattlecardPayload
    if (!battlecardInput.competitor || !battlecardInput.positioning) {
      throw new Error("battlecard mode requires 'competitor' and 'positioning' in payload")
    }

    const target = await resolveCompetitorTarget(battlecardInput.competitor)
    const pageText = await fetchPageText(target.url)
    if (!pageText || pageText.length < 200) {
      throw new Error(`Could not read enough content from ${target.url} to ground a battlecard (likely JS-rendered or blocked)`)
    }

    topic = `${target.name} battlecard`
    meta = { competitorUrl: target.url }

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5",
      system: BATTLECARD_SYSTEM,
      prompt: buildBattlecardPrompt({
        competitorName: target.name,
        competitorPageText: pageText,
        positioning: battlecardInput.positioning,
        ourAdvantages: battlecardInput.ourAdvantages,
        tone: battlecardInput.tone,
        style: battlecardInput.style,
        mood: battlecardInput.mood,
      }),
      maxOutputTokens: 4000,
      temperature: 0.4,
    })
    body = text
  } else {
    throw new Error(`Unknown content mode: ${mode}`)
  }

  const db = await getDb()
  const contentId = randomUUID()
  const now = new Date()

  await db.collection<ContentDoc>("content").insertOne({
    contentId,
    userId: task.userId,
    mode,
    topic,
    body,
    ...(items ? { items } : {}),
    ...(brief ? { brief } : {}),
    ...(regeneratedFrom ? { regeneratedFrom } : {}),
    ...(meta ? { meta } : {}),
    status: "draft",
    sourceTaskId: task.taskId,
    createdAt: now,
    updatedAt: now,
  })

  return {
    contentId,
    mode,
    topic,
    ...(items ? { itemCount: items.length } : { wordCount: body.trim().split(/\s+/).length }),
  }
}
