// Mode-aware Content Quality Scorecard for case_study drafts.
// Criteria enforce the anti-hallucination requirements that are the entire
// point of the case-study prompt (case-study.ts, ported from Skribil's
// handleCaseStudyGeneration §2) — this is the mode where a failed grade
// matters most, since a fabricated stat or invented quote in a case study
// is a real, publishable liability, not just a style miss.

export const CASE_STUDY_SCORECARD_SYSTEM = `You are a strict fact-checker grading a case study draft before publish.
Your primary job is catching fabrication: any name, number, quote, or detail that was not in the source facts is a serious failure, not a minor style note.
Do not soften the grade to be encouraging — a factually clean but plain case study should still outscore a vivid but embellished one.`

export function buildCaseStudyScorecardPrompt(topic: string, body: string, sourceFacts: string): string {
  return `Grade this case study draft, written about: "${topic}"

Here are the ONLY facts the writer was given to work with:
${sourceFacts}

Check the draft against these criteria — the first two are the most important:
- Contains no invented statistics, metrics, or numbers beyond what's in the source facts
- Contains no invented quotes, names, companies, or details not present in the source facts
- Follows the required structure: Customer Background, The Challenge, The Solution, Results and Impact (plus a Testimonial section only if a quote was provided)
- Uses the customer's real name and role consistently throughout, unchanged from the source facts
- Results are presented as stated, not embellished or exaggerated beyond the source facts
- Professional, factual, credible tone — no marketing fluff or generic hype language

Score against exactly these six criteria in the breakdown, plus overall credibility. For each criterion: state whether it was met, and give a one-sentence, specific note — if something was fabricated, quote the fabricated text and name what source fact it should have come from instead.

fixGuidance should be a short list of concrete, actionable fixes — not general advice. If nothing needs fixing, return an empty array.

DRAFT:
${body}`
}
