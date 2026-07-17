import type { TaskDoc } from "@/lib/tasks"
import { enqueueTask } from "@/lib/tasks"
import { getDb } from "@/lib/mongodb"
import { generateContent, type ContentDoc } from "./writer"
import { scoreContent } from "./evaluator"

// Below this score, the orchestrator treats a draft as worth auto-fixing
// rather than shipping as-is. Tunable; not a formal product decision yet.
const REGENERATION_SCORE_THRESHOLD = 90

// Dispatcher — maps a queued task to the agent handler that executes it.
// New task types (fetch_competitor_content, ...) get a case here as their
// agents are built out in later phases (migration.md §5).
export async function runTask(task: TaskDoc): Promise<Record<string, unknown>> {
  switch (task.type) {
    case "generate_content":
      return generateContent(task)
    case "score_content":
      return scoreContent(task)
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
    const content = await db.collection<ContentDoc>("content").findOne({ contentId: result.contentId })

    if (!content) return
    // Auto-regeneration only knows how to rebuild a blog_post payload so far.
    // landing_page/case_study get real grades but not yet an auto-fix —
    // reconstructing their structured payloads (title/CTA/bullets, or
    // customer/problem/solution/results) from fixGuidance text is real work,
    // not a copy-paste of this branch. Scored-but-not-regenerated is a valid
    // stopping point, not a bug.
    if (content.mode !== "blog_post") return
    // Cap at one auto-fix pass — don't chain regenerations of regenerations.
    if (content.regeneratedFrom) return
    if (typeof content.score !== "number" || content.score >= REGENERATION_SCORE_THRESHOLD) return

    const fixNotes = (content.fixGuidance ?? []).map((f) => `- ${f}`).join("\n")
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
  }
}
