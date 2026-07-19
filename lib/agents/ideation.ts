import { randomUUID } from "crypto"
import { generateObject } from "ai"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import type { ContentMode } from "./writer"
import type { SerpSnapshotDoc } from "./serp-monitor"
import { ideationSchema, IDEATION_SYSTEM, buildIdeationPrompt, type SerpKeywordSummary } from "./prompts/ideation"

// ---------------------------------------------------------------------------
// Ideation agent — suggest_ideas task handler.
// Works from real SERP monitoring data (serp-monitor.ts): the keywords
// actually being tracked and the current ranking landscape for each, so
// ideas answer "what should I write to rank for this" rather than "what
// should I write next based on what already scored well" (that question
// belongs to the evaluator/Scorecard, not ideation — see prompts/ideation.ts).
// ---------------------------------------------------------------------------

export type IdeaSuggestion = {
  topic: string
  mode: ContentMode
  targetKeyword: string
  rationale: string
}

export type IdeationDoc = {
  _id?: string
  ideationId: string
  userId: string
  ideas: IdeaSuggestion[]
  basedOnKeywords: string[]
  sourceTaskId: string
  createdAt: Date
}

type SuggestIdeasPayload = {
  numIdeas?: number
}

export async function suggestIdeas(task: TaskDoc): Promise<Record<string, unknown>> {
  const { numIdeas = 3 } = task.payload as SuggestIdeasPayload

  const db = await getDb()
  const snapshots = db.collection<SerpSnapshotDoc>("serp_snapshots")

  // Latest snapshot per distinct keyword — the current ranking picture for
  // every keyword actually being tracked, not every historical check.
  const latestPerKeyword = await snapshots
    .aggregate<SerpSnapshotDoc>([
      { $match: { userId: task.userId } },
      { $sort: { capturedAt: -1 } },
      { $group: { _id: "$keyword", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
    ])
    .toArray()

  if (latestPerKeyword.length === 0) {
    throw new Error("No SERP keyword checks yet — check some rankings first before suggesting ideas")
  }

  const summaries: SerpKeywordSummary[] = latestPerKeyword.map((s) => ({
    keyword: s.keyword,
    ownPosition: s.ownPosition ?? null,
    topResults: s.results.slice(0, 5).map((r) => ({ position: r.position, title: r.title })),
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
    basedOnKeywords: summaries.map((s) => s.keyword),
    sourceTaskId: task.taskId,
    createdAt: now,
  })

  return { ideationId, ideaCount: object.ideas.length, basedOnCount: summaries.length }
}
