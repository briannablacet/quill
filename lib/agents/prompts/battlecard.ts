// Battlecard — rebuilt from Skribil's handleBattlecardGeneration (§2), not
// ported as-is. The original prompt asked the LLM for "exact rebuttals" and
// "quotable statistics" about a named competitor while providing zero real
// data — the same fabrication risk case-study.ts's prompt exists to prevent,
// just uncaught here in the original. This version keeps Skribil's genuinely
// good structure (snapshot / strengths / weaknesses / our advantages /
// objection handling / discovery questions / closing insights) but requires
// every competitor-facing claim to trace back to real fetched page content,
// and "our advantages" to trace back to what the user actually told it.

import { buildStyleGuideInstructions, buildToneInstructions, type WritingStyle, type BrandVoice, type Messaging } from "./style-guide"

export const BATTLECARD_SYSTEM = `You are a competitive intelligence strategist creating a battlecard grounded strictly in real evidence: the competitor's actual current page content, and the user's own stated positioning.
Never invent a statistic, customer scenario, or "quotable" claim that isn't actually supported by the material you were given. If the evidence doesn't support a section, say what's missing rather than filling it with a plausible-sounding fabrication.`

export type BattlecardBrief = {
  competitorName: string
  competitorPageText: string
  positioning: string
  ourAdvantages?: string
  tone?: string
  style?: string
  mood?: string
  writingStyle?: WritingStyle
  brandVoice?: BrandVoice
  messaging?: Messaging
}

export function buildBattlecardPrompt(input: BattlecardBrief): string {
  const toneInstructions = buildToneInstructions(input.tone, input.style, input.mood)
  const styleInstructions = buildStyleGuideInstructions(input.writingStyle, input.brandVoice, input.messaging)

  return `Create a competitive battlecard for sales teams.

COMPETITOR: ${input.competitorName}

ACTUAL COMPETITOR PAGE CONTENT (fetched live — the only source of truth about what they claim):
${input.competitorPageText}

YOUR PRODUCT'S POSITIONING (as stated by the user — treat as fact, do not embellish beyond it):
${input.positioning}
${input.ourAdvantages ? `\nSPECIFIC ADVANTAGES TO HIGHLIGHT (as stated by the user):\n${input.ourAdvantages}` : ""}

${toneInstructions}
${styleInstructions}

ANTI-AI WRITING RULES:
- NO BATTLE METAPHORS: skip "ammunition," "weapon," "arsenal"
- CONCRETE SPECIFICS ONLY WHEN THE EVIDENCE SUPPORTS THEM: if the competitor's page states a specific number or claim, cite it; do not invent percentages or timeframes that aren't in the source material
- NATURAL CONFIDENCE: sound certain without sounding arrogant
- VARIED SENTENCE PATTERNS

BATTLECARD STRUCTURE:
1. COMPETITIVE SNAPSHOT: who they are, based on what their own page actually says
2. THEIR STRENGTHS: what they do well, drawn from their actual page content (be honest — this builds credibility, and a battlecard that pretends the competitor has no strengths isn't useful)
3. THEIR WEAKNESSES: what's notably absent, vague, or unaddressed in their actual page content — not assumed weaknesses
4. OUR ADVANTAGES: based strictly on the positioning and advantages provided above
5. OBJECTION RESPONSES: how to respond if a prospect cites something the competitor's page actually claims
6. DISCOVERY QUESTIONS: questions that would reveal whether the competitor's actual claimed strengths matter to this specific prospect
7. CLOSING INSIGHTS: how to position the decision, grounded in the real positioning given

If the competitor's page content is too thin to responsibly fill a section (e.g. no pricing info, no specific claims to rebut), say so explicitly in that section rather than inventing something plausible.`
}
