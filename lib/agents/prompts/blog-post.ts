// Extracted from Skribil's api_endpoints.ts handleEnhancedContent (the
// "blog-post" content type inside its campaign-generation handler) —
// migration.md §2. This is the real prompt, not a rewrite: the style-ban
// list, CTA rules, heading enforcement, and vendor-neutral rule are load-
// bearing product decisions refined over Skribil's production use, kept
// verbatim. Only the input shape changed (Quill's simpler topic/brief vs.
// Skribil's full campaignData object) and the model line moved to Claude.

import { buildStyleGuideInstructions, buildToneInstructions, type WritingStyle, type BrandVoice, type Messaging } from "./style-guide"

export const BLOG_POST_SYSTEM =
  "You are a professional writer. Write in plain text format without markdown or special characters."

export type BlogPostBrief = {
  topic: string
  brief?: string
  targetAudience?: string
  callToAction?: string
  tone?: string
  style?: string
  mood?: string
  writingStyle?: WritingStyle
  brandVoice?: BrandVoice
  messaging?: Messaging
}

export function buildBlogPostPrompt(input: BlogPostBrief): string {
  const styleInstructions = buildStyleGuideInstructions(input.writingStyle, input.brandVoice, input.messaging)
  const toneInstructions = buildToneInstructions(input.tone, input.style, input.mood)

  const ctaBlock = input.callToAction
    ? `
CTA OUTPUT RULES (MANDATORY—DO NOT IGNORE):
- After completing your final paragraph, insert a blank line, then place the call-to-action sentence on its own line.
- The CTA sentence MUST clearly state the offer (e.g., "Download the eBook", "Sign up for the free webinar") AND briefly restate the value/benefit in natural language.
- Example: "Ready to transform your gym's online presence? Download the eBook today."
- The CTA must be the FINAL line of the article. Nothing comes after it.
- Use this exact offer text as the base for the CTA: ${JSON.stringify(input.callToAction)}
`
    : `
CTA OUTPUT RULES:
- End with a short, imperative call-to-action on its own line.
- Clearly restate the offer and benefit.
- Must be the final line of the article.
`

  return `🚨 MANDATORY STYLE RULES - FOLLOW EXACTLY:
${styleInstructions || "(no style guide configured yet — write in clear, professional prose)"}

⚠️ HEADING ENFORCEMENT: Use clear headings and subheadings in plain text format. Include an H1 heading at the top. No colons at the end of headings.

${toneInstructions}

Write a 1,500-word article about: "${input.topic}"
${input.brief ? `\nBrief / additional context:\n${input.brief}` : ""}

STRUCTURE:
- Engaging opening (~250 words)
- 4–5 substantial sections with clear, descriptive subheadings (~200–250 words each)
- Strong closing paragraph (~150 words) that naturally leads to the CTA

TARGET AUDIENCE: ${input.targetAudience ?? "general readers of this content"}
STYLE BANS: Avoid clichés like "Imagine this". Never use "Introduction" or "Conclusion" as subheadings. No horizontal rules/dividers.
Avoid these words/roots as ordinary vocabulary (quoting them verbatim inside a real, existing proper noun or job title — e.g. "Director of AI Transformation" — is fine; using the root word to describe or characterize something is not): revolutionize/revolutionizing/revolution, transform/transforming/transformation, disrupt/disrupting/disruption, reinvent/reinventing, evolve/evolving/evolution, unlock/unlocking, elevate/elevating, accelerate, amplify/amplified, empower/empowering/empowerment, master/mastering/mastery, unleash/unleashing, unchain/unchaining, leverage/leveraging, synergy/synergize, paradigm, innovative, cutting-edge, next-level, game-changing, breakthrough, seamless, scalable, robust, dynamic, strategic, holistic, comprehensive, integrated, streamlined, optimize/optimizing, maximize, thrilled, thrill.
If the topic itself centers on one of these concepts (e.g. a topic about "transformation"), find a different word for the concept throughout the piece (e.g. "adoption," "shift," "overhaul") rather than repeating the banned root.

CONTENT RULE: Be vendor-neutral for ~90% of the piece. Focus on industry insights, best practices, and valuable advice. Do NOT mention products/services/eBooks until the very end.
${ctaBlock}
Formatting: plain text only (no markdown, asterisks, or special formatting). Headings/subheads must be plain text with line breaks, not labels.
Return only the article text.`
}
