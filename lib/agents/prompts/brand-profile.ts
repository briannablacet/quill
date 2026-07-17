// Brand profile extraction — turns a real style guide + messaging doc into
// structured data the writer/evaluator agents can actually use. Real style
// guides are prose, not key-value pairs (see migration.md §5 Phase 5 note),
// so this uses generateObject rather than regex/keyword parsing — the same
// "let the model read it properly" approach used everywhere else in Quill,
// not a bespoke parser that breaks the moment a doc's structure varies.

import { z } from "zod"

export const brandProfileExtractionSchema = z.object({
  brandName: z.string(),
  tagline: z.string().optional(),
  boilerplate: z
    .object({
      short: z.string().optional().describe("Shortest boilerplate, ~30 words"),
      medium: z.string().optional().describe("Medium boilerplate, ~50 words"),
      long: z.string().optional().describe("Longest boilerplate, ~80 words"),
    })
    .optional(),
  voice: z.object({
    toneDescription: z.string().describe("How the brand's tone is described, in the source's own words where possible"),
    stylePoints: z.array(z.string()).describe("Concrete writing style rules, e.g. 'active voice', 'address the reader as you'"),
    avoidPhrases: z.array(z.string()).describe("Specific words, phrases, or patterns the guide says to avoid"),
  }),
  styleRules: z.object({
    oxfordComma: z.boolean().optional(),
    ctaFormat: z.string().optional().describe("How calls-to-action should be formatted, if specified"),
    terminology: z
      .array(z.object({ term: z.string(), rule: z.string() }))
      .describe("Specific term-by-term style conventions, e.g. 'agentic AI' -> 'no caps'"),
    customRules: z.array(z.string()).describe("Other concrete formatting/punctuation rules not captured above"),
  }),
  messaging: z.object({
    valueProposition: z.string().optional(),
    keyMessages: z.array(z.string()).describe("Core recurring messages/themes, not restated boilerplate"),
    proofPoints: z.array(z.string()).describe("Specific, concrete proof points or stats the messaging doc actually states"),
  }),
})

export const BRAND_PROFILE_EXTRACTION_SYSTEM = `You extract structured brand voice, style, and messaging data from real internal documents.
Extract only what the source documents actually say — do not invent style rules, proof points, or messaging that isn't genuinely present in the text.
The source text was extracted from Word documents and may contain leftover XML/markup noise, table artifacts, or a table of contents — ignore that noise and extract only substantive content.`

export function buildBrandProfileExtractionPrompt(styleGuideText: string, messagingText: string): string {
  return `Extract a structured brand profile from these two real internal documents.

=== STYLE GUIDE ===
${styleGuideText}

=== MESSAGING / MESSAGE PLATFORM DOCUMENT ===
${messagingText}

Extract:
- Brand name, tagline, and boilerplate copy (if multiple lengths are given, sort into short/medium/long)
- Voice: how tone is described, concrete style points (e.g. active voice, pronoun rules), and specific phrases/words to avoid
- Style rules: Oxford comma usage, CTA formatting, term-by-term style conventions (e.g. specific capitalization/hyphenation rules for named terms), and other concrete formatting rules
- Messaging: the value proposition, key recurring messages, and specific proof points (real stats/claims, not generic marketing language)

Be selective — extract genuinely reusable, specific rules and messages, not the entire document restated.`
}
