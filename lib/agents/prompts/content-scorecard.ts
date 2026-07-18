// Content Quality Scorecard — the evaluator agent's grading prompt.
// Concept ported from the personal business-case doc (migration.md §3): a
// letter grade with a breakdown of *why* plus concrete fix guidance, applied
// to a draft before publish. Retrieval-layer criteria (migration.md §5
// Phase 5) are added below when a real brand profile exists — grading
// against actual brand rules (a real "avoid saying we," a real Oxford
// comma requirement), not just generic article structure.

import { z } from "zod"

export const scorecardSchema = z.object({
  grade: z.enum(["A", "B", "C", "D", "F"]),
  score: z.number().min(0).max(100),
  breakdown: z
    .array(
      z.object({
        criterion: z.string(),
        met: z.boolean(),
        note: z.string(),
      })
    )
    .min(1),
  fixGuidance: z.array(z.string()),
})

export const SCORECARD_SYSTEM = `You are a strict, experienced content editor grading a draft before publish.
Be honest and specific — vague praise is not useful. A draft that violates its own stated constraints should not score well, even if it reads smoothly.
Do not soften the grade to be encouraging. The point of this scorecard is to catch real problems before a human wastes time on a weak draft.`

export function buildScorecardPrompt(topic: string, body: string, brandRules?: string[]): string {
  const brandSection = brandRules?.length
    ? `\nIt also needed to follow these real brand style rules — check compliance with each one specifically, and quote the violating text if a rule was broken:\n${brandRules.map((r) => `- ${r}`).join("\n")}\n`
    : ""

  return `Grade this content draft. The draft was written on the topic: "${topic}"

It was generated under these constraints — check compliance with each one specifically:
- Engaging, non-generic opening (no "Imagine this..." or similar clichés)
- Clear headings/subheadings; never literally "Introduction" or "Conclusion" as a heading
- Vendor-neutral for roughly the first 90% of the piece — no pitching a product/service until the very end
- Avoids banned words: revolutionize(ing/-tion), transform(ing/-ation), disrupt(ing/-ion), reinvent(ing), evolve/evolving/evolution, unlock(ing), elevate/elevating, accelerate, amplify/amplified, empower(ing/-ment), master/mastering/mastery, unleash(ing), unchain(ing), leverage/leveraging, synergy/synergize, paradigm, innovative, cutting-edge, next-level, game-changing, breakthrough, seamless, scalable, robust, dynamic, strategic, holistic, comprehensive, integrated, streamlined, optimize/optimizing, maximize, thrilled, thrill
- No alliteration (e.g. "Bold, Brilliant, Boundless") — reads as a lazy shortcut for memorable rather than actually being memorable
- Ends with a single, clear, imperative call-to-action as the final line
- No fabricated statistics, quotes, customer names, or specific claims that read as invented rather than general knowledge
- Em dash cadence: no more than one em dash per paragraph, never two in the same sentence or back-to-back sentences
- No choppy sentence sequences — especially in definitional/explanatory passages, avoid strings of short, similarly-structured sentences that read like unbulleted bullet points (a common model habit); prose should flow with varied sentence length and real connective structure
- No duplicated phrasing — the same distinctive word, phrase, or sentence structure should not repeat across multiple sections
${brandSection}
Score against exactly these criteria in the breakdown (ten general criteria${brandRules?.length ? ", plus each brand rule listed above" : ""}), plus overall clarity and structure. For each criterion: state whether it was met, and give a one-sentence, specific note (quote the offending phrase if it failed).

fixGuidance should be a short list of concrete, actionable fixes — not general advice. If nothing needs fixing, return an empty array.

DRAFT:
${body}`
}
