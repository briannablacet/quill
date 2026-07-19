import { randomUUID } from "crypto"
import { generateText } from "ai"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import type { ContentDoc } from "./writer"
import { REVISE_CONTENT_SYSTEM, buildRevisePrompt } from "./prompts/revise-content"
import { getBrandRules } from "./evaluator"

// ---------------------------------------------------------------------------
// Reviser agent — revise_content task handler. The explicit, user-triggered
// counterpart to the orchestrator's automatic regeneration (lib/agents/
// index.ts): uploaded content is never auto-rewritten (see writer.ts's
// ContentDoc.origin comment), but the user can ask for a fix directly via
// the Edit/Review "Fix This" action. Reuses the exact fixGuidance already
// produced by the evaluator agent rather than re-deriving what's wrong.
// ---------------------------------------------------------------------------

type ReviseContentPayload = {
  contentId: string
}

export async function reviseContent(task: TaskDoc): Promise<Record<string, unknown>> {
  const { contentId } = task.payload as ReviseContentPayload

  if (!contentId || typeof contentId !== "string") {
    throw new Error("revise_content task requires a non-empty 'contentId' in payload")
  }

  const db = await getDb()
  const contentCollection = db.collection<ContentDoc>("content")
  const original = await contentCollection.findOne({ contentId, userId: task.userId })

  if (!original) {
    throw new Error(`No content document found for contentId: ${contentId}`)
  }
  if (!original.fixGuidance || original.fixGuidance.length === 0) {
    throw new Error("This content has no fix guidance to apply — score it first")
  }

  const brandRules = await getBrandRules(task.userId)

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-5",
    system: REVISE_CONTENT_SYSTEM,
    prompt: buildRevisePrompt(original.topic, original.body, original.fixGuidance, brandRules),
    maxOutputTokens: 6000,
    temperature: 0.3,
  })

  if (!text || text.trim().length === 0) {
    throw new Error("Revision returned no content — the model returned an empty response")
  }

  const contentIdNew = randomUUID()
  const now = new Date()

  await contentCollection.insertOne({
    contentId: contentIdNew,
    userId: task.userId,
    mode: original.mode,
    topic: original.topic,
    body: text,
    ...(original.meta ? { meta: original.meta } : {}),
    regeneratedFrom: original.contentId,
    origin: "uploaded",
    status: "draft",
    sourceTaskId: task.taskId,
    createdAt: now,
    updatedAt: now,
  })

  return { contentId: contentIdNew }
}
