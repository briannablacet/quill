import { randomUUID } from "crypto"
import { generateObject } from "ai"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import type { ContentDoc, ContentMode } from "./writer"
import { ideationSchema, IDEATION_SYSTEM, buildIdeationPrompt, type ScoredContentSummary } from "./prompts/ideation"

// ---------------------------------------------------------------------------
// Ideation agent — suggest_ideas task handler.
// See migration.md §5 Phase 5. Works from real Scorecard data (the closest
// available substitute for the performance-analyst "working" list this was
// originally scoped to need — see prompts/ideation.ts).
// ---------------------------------------------------------------------------

export type IdeaSuggestion = {
  topic: string
  mode: ContentMode
  rationale: string
}

export type IdeationDoc = {
  _id?: string
  ideationId: string
  userId: string
  ideas: IdeaSuggestion[]
  basedOnContentIds: string[]
  sourceTaskId: string
  createdAt: Date
}

type SuggestIdeasPayload = {
  numIdeas?: number
  minScore?: number
}

export async function suggestIdeas(task: TaskDoc): Promise<Record<string, unknown>> {
  const { numIdeas = 3, minScore = 85 } = task.payload as SuggestIdeasPayload

  const db = await getDb()
  const contentCollection = db.collection<ContentDoc>("content")

  const scored = await contentCollection
    .find({ userId: task.userId, score: { $gte: minScore } })
    .sort({ score: -1 })
    .toArray()

  if (scored.length === 0) {
    throw new Error(`No scored content found with score >= ${minScore} — nothing to base ideas on yet`)
  }

  const summaries: ScoredContentSummary[] = scored.map((c) => ({
    topic: c.topic,
    mode: c.mode,
    score: c.score ?? 0,
    metCriteria: (c.breakdown ?? []).filter((b) => b.met).map((b) => b.criterion),
  }))

  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-5",
    schema: ideationSchema,
    system: IDEATION_SYSTEM,
    prompt: buildIdeationPrompt(summaries, numIdeas),
    temperature: 0.6,
  })

  const ideationId = randomUUID()
  const now = new Date()

  await db.collection<IdeationDoc>("ideas").insertOne({
    ideationId,
    userId: task.userId,
    ideas: object.ideas,
    basedOnContentIds: scored.map((c) => c.contentId),
    sourceTaskId: task.taskId,
    createdAt: now,
  })

  return { ideationId, ideaCount: object.ideas.length, basedOnCount: scored.length }
}
