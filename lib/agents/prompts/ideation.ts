// Ideation agent prompt. Works from real SERP monitoring data
// (lib/agents/serp-monitor.ts) — the keywords actually being tracked,
// where the user currently ranks (or doesn't), and who's actually ranking
// above them — rather than the Content Quality Scorecard. The Scorecard
// measures writing quality on drafts already written; it has nothing to
// say about what's worth writing next to win a ranking that isn't won yet.

import { z } from "zod"

export const ideationSchema = z.object({
  ideas: z
    .array(
      z.object({
        topic: z.string(),
        mode: z.enum(["blog_post", "landing_page", "case_study", "social_media", "taglines"]),
        targetKeyword: z.string(),
        rationale: z.string(),
      })
    )
    .min(1),
})

export const IDEATION_SYSTEM = `You are a content strategist generating new content ideas to help a company rank for keywords it actually cares about, based on real SERP data: its current ranking (or lack of one) for each keyword, and who is actually ranking above it.
Every idea must target one of the provided keywords specifically and explain how the proposed piece would compete against what's currently ranking there. Do not propose ideas unconnected to the provided keywords.`

export type SerpKeywordSummary = {
  keyword: string
  ownPosition: number | null
  topResults: { position: number; title: string }[]
}

export function buildIdeationPrompt(keywords: SerpKeywordSummary[], numIdeas: number): string {
  const summary = keywords
    .map((k) => {
      const ranking = k.ownPosition ? `currently ranking #${k.ownPosition}` : "not currently ranking in the top results"
      const competitors = k.topResults.map((r) => `#${r.position} "${r.title}"`).join("; ")
      return `- Keyword: "${k.keyword}" — ${ranking}. Currently ranking there: ${competitors || "no results captured"}`
    })
    .join("\n")

  return `Here are the keywords being tracked in SERP monitoring, with the current ranking landscape for each:

${summary}

Based ONLY on these real keywords and what's actually ranking for them, suggest ${numIdeas} new content ideas to help win or improve ranking on these specific keywords.

For each idea, give:
- topic: a specific, concrete content topic (not vague, not a finished headline — directional enough that a writer knows what to draft)
- mode: which content mode it should be (blog_post, landing_page, case_study, social_media, or taglines)
- targetKeyword: which keyword above this idea is meant to help rank for (must be exactly one of the keywords listed)
- rationale: what's currently ranking for that keyword and specifically what gap or angle this piece would exploit to compete against it

If a keyword's current results give too little to go on, say so explicitly in the rationale rather than inventing a generic idea.`
}
