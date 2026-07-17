// Ideation agent prompt. migration.md §5 Phase 5 originally scoped this to
// work from a performance analyst's "working" list (real published-content
// metrics) — that data source doesn't exist yet (no external analytics
// available). Substituted with real data that does exist: the Content
// Quality Scorecard. High-scoring drafts are the closest available signal
// for "what's actually working," grounded in the evaluator's own specific
// reasoning (breakdown notes), not a vibe.

import { z } from "zod"

export const ideationSchema = z.object({
  ideas: z
    .array(
      z.object({
        topic: z.string(),
        mode: z.enum(["blog_post", "landing_page", "case_study", "social_media", "taglines"]),
        rationale: z.string(),
      })
    )
    .min(1),
})

export const IDEATION_SYSTEM = `You are a content strategist generating new content ideas from evidence of what has actually scored well, not from generic industry best practices.
Every idea must trace back to a specific pattern in the provided high-scoring content — cite what worked. Do not propose ideas that are only loosely related or that you'd suggest regardless of the input data.`

export type ScoredContentSummary = {
  topic: string
  mode: string
  score: number
  metCriteria: string[]
}

export function buildIdeationPrompt(scoredContent: ScoredContentSummary[], numIdeas: number): string {
  const summary = scoredContent
    .map(
      (c) =>
        `- "${c.topic}" (${c.mode}, scored ${c.score}/100) — what worked: ${c.metCriteria.join("; ") || "no specific criteria notes available"}`
    )
    .join("\n")

  return `Here is every piece of content that has been generated and scored so far, with what the evaluator specifically noted worked:

${summary}

Based ONLY on the patterns visible in this real data — topics, modes, and specifically what the evaluator praised — suggest ${numIdeas} new content ideas.

For each idea, give:
- topic: a specific, concrete content topic (not vague)
- mode: which content mode it should be (blog_post, landing_page, case_study, social_media, or taglines)
- rationale: which specific piece(s) above it builds on, and what pattern from those scores justifies this idea

If the data is too thin or too narrowly focused on one theme to responsibly generalize from, say so explicitly in the rationale rather than inventing an idea the data doesn't actually support.`
}
