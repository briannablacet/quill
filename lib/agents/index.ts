import type { TaskDoc } from "@/lib/tasks"
import { enqueueTask } from "@/lib/tasks"
import { getDb } from "@/lib/mongodb"
import { generateContent, type ContentDoc } from "./writer"
import { scoreContent } from "./evaluator"
import { fetchCompetitorContent } from "./competitive-intel"
import { monitorSerp } from "./serp-monitor"
import { suggestIdeas } from "./ideation"

// Below this score, the orchestrator treats a draft as worth auto-fixing
// rather than shipping as-is. Tunable; not a formal product decision yet.
const REGENERATION_SCORE_THRESHOLD = 90

// Dispatcher — maps a queued task to the agent handler that executes it.
export async function runTask(task: TaskDoc): Promise<Record<string, unknown>> {
  switch (task.type) {
    case "generate_content":
      return generateContent(task)
    case "score_content":
      return scoreContent(task)
    case "fetch_competitor_content":
      return fetchCompetitorContent(task)
    case "monitor_serp":
      return monitorSerp(task)
    case "suggest_ideas":
      return suggestIdeas(task)
    default:
      throw new Error(`No agent handler for task type: ${task.type}`)
  }
}

// Modes with real, mode-aware Scorecard criteria (evaluator.ts). Modes not
// in this list (taglines, social_media) produce list-shaped output that the
// current criteria families don't fit — scoring them would mean grading
// against rules that don't apply, so they're left unscored rather than
// given a misleading grade.
const SCORABLE_MODES = new Set(["blog_post", "landing_page", "case_study"])

// Orchestrator behavior (migration.md §5 Phase 4): the system decides its
// own follow-up work from results, rather than following a fixed script.
// Two decisions live here so far:
//   1. generate_content (scorable mode) done  -> enqueue score_content
//   2. score_content done, score too low       -> enqueue a regeneration
// This stays a plain function rather than a formal "orchestrator" module
// until there's a third kind of decision that actually needs shared state.
export async function enqueueFollowUps(task: TaskDoc, result: Record<string, unknown>): Promise<void> {
  const mode = (task.payload as { mode?: string }).mode ?? "blog_post"

  if (task.type === "generate_content" && SCORABLE_MODES.has(mode) && typeof result.contentId === "string") {
    await enqueueTask(task.userId, "score_content", { contentId: result.contentId })
    return
  }

  if (task.type === "score_content" && typeof result.contentId === "string") {
    const db = await getDb()
    const contentCollection = db.collection<ContentDoc>("content")
    const content = await contentCollection.findOne({ contentId: result.contentId })

    if (!content) return

    // Regeneration safety net: a rewrite that fixes every flagged issue can
    // still introduce new ones and score *worse* overall (verified live —
    // migration.md §5). Nothing else in the system would otherwise catch
    // that, so record the outcome explicitly rather than letting a worse
    // draft silently stand as "the" result.
    if (content.regeneratedFrom && typeof content.score === "number") {
      const original = await contentCollection.findOne({ contentId: content.regeneratedFrom })
      if (original && typeof original.score === "number") {
        const regenerationOutcome: "improved" | "regressed" | "unchanged" =
          content.score > original.score ? "improved" : content.score < original.score ? "regressed" : "unchanged"
        await contentCollection.updateOne({ contentId: content.contentId }, { $set: { regenerationOutcome, previousScore: original.score } })
      }
    }

    // Cap at one auto-fix pass — don't chain regenerations of regenerations.
    if (content.regeneratedFrom) return
    if (typeof content.score !== "number" || content.score >= REGENERATION_SCORE_THRESHOLD) return

    const fixNotes = (content.fixGuidance ?? []).map((f) => `- ${f}`).join("\n")
    if (!fixNotes) return

    if (content.mode === "blog_post") {
      const revisedBrief = [
        content.brief,
        `This is a revision of an earlier draft that scored ${content.score}/100. Fix these specific issues:`,
        fixNotes,
      ]
        .filter(Boolean)
        .join("\n\n")

      await enqueueTask(task.userId, "generate_content", {
        mode: "blog_post",
        topic: content.topic,
        brief: revisedBrief,
        regeneratedFrom: content.contentId,
      })
      return
    }

    if (content.mode === "landing_page" && content.meta?.originalPayload) {
      const original = JSON.parse(content.meta.originalPayload)
      const revisedDetails = [
        original.additionalDetails,
        `This is a revision of an earlier draft that scored ${content.score}/100. Fix these specific issues:`,
        fixNotes,
      ]
        .filter(Boolean)
        .join("\n\n")

      await enqueueTask(task.userId, "generate_content", {
        mode: "landing_page",
        ...original,
        additionalDetails: revisedDetails,
        regeneratedFrom: content.contentId,
      })
      return
    }

    if (content.mode === "case_study" && content.meta?.originalPayload) {
      // The facts (customerName/problem/solution/results/etc.) are carried
      // over unchanged from the original payload — a case study regeneration
      // fixes prose/tone/structure, never the underlying facts.
      const original = JSON.parse(content.meta.originalPayload)
      const revisedDetails = [
        original.additionalDetails,
        `This is a revision of an earlier draft that scored ${content.score}/100. Fix these specific issues (do not change any of the facts above):`,
        fixNotes,
      ]
        .filter(Boolean)
        .join("\n\n")

      await enqueueTask(task.userId, "generate_content", {
        mode: "case_study",
        ...original,
        additionalDetails: revisedDetails,
        regeneratedFrom: content.contentId,
      })
      return
    }

    // Other modes (social_media, battlecard, taglines) don't have an auto-fix
    // path yet — either unscored, or scored-but-not-regenerated is a valid
    // stopping point rather than a gap to force-close here.
  }
}
