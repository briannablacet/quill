// Mode-aware Content Quality Scorecard for landing_page drafts.
// Criteria are drawn from the actual format spec in landing-page.ts (ported
// from Skribil's handleLandingPageGeneration §2) rather than reusing
// blog_post's article-specific criteria (CTA-as-final-line still applies,
// but "vendor-neutral for 90%" and "headings" do not — a landing page is
// vendor-forward by design).

export const LANDING_PAGE_SCORECARD_SYSTEM = `You are a strict, experienced conversion copywriter grading a landing page draft before publish.
Be honest and specific — vague praise is not useful. A draft that violates its own format requirements should not score well, even if the prose reads smoothly.`

export function buildLandingPageScorecardPrompt(topic: string, body: string, callToAction: string, brandRules?: string[]): string {
  const brandSection = brandRules?.length
    ? `\nIt also needed to follow these real brand style rules — check compliance with each one specifically, and quote the violating text if a rule was broken:\n${brandRules.map((r) => `- ${r}`).join("\n")}\n`
    : ""

  return `Grade this landing page draft. It was written for: "${topic}"

It was generated under these format requirements — check compliance with each one specifically:
- Structure: title, then a 2-3 sentence intro paragraph, then bullet points, then the CTA
- Each bullet is formatted as "- [point]. [one explanatory sentence]" — a period before the explanation, not a colon or dash
- The exact call-to-action text the user specified was: "${callToAction}"
- That CTA must appear verbatim as the final line — no paraphrasing, no placeholder brackets like "[INSERT CTA HERE]"
- No bracketed placeholder text anywhere in the final output (that would mean a template slot was left unfilled)
- The intro paragraph is genuinely 2-3 sentences, not a single line or a long block
${brandSection}
Score against exactly these criteria in the breakdown (six format criteria${brandRules?.length ? ", plus each brand rule listed above" : ""}), plus overall persuasiveness. For each criterion: state whether it was met, and give a one-sentence, specific note (quote the offending text if it failed).

fixGuidance should be a short list of concrete, actionable fixes — not general advice. If nothing needs fixing, return an empty array.

DRAFT:
${body}`
}
