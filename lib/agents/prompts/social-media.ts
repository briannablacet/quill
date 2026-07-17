// Extracted from Skribil's api_endpoints.ts handleSocialMediaGeneration (§2).
// The real per-platform guidelines table and variation-approach labels are
// kept as-is. Simplified to one platform per task (Skribil looped over a
// platforms[] array in one request) — each platform is its own generate_content
// call here, consistent with how every other mode in Quill works.

import { z } from "zod"
import { buildStyleGuideInstructions, type WritingStyle, type BrandVoice, type Messaging } from "./style-guide"

export type SocialPlatform = "linkedin" | "twitter" | "facebook" | "instagram"

// Wrapped in an object rather than a bare top-level array: every other
// generateObject call in Quill uses a top-level object schema, and this is
// the one place that didn't — a top-level array schema is a rougher fit for
// tool-based structured output and started intermittently failing to parse
// once prompts got longer (brand rules added). Real bug, not a token issue.
export const socialMediaSchema = z.object({
  posts: z.array(z.string()).min(1),
})

export const VARIATION_APPROACHES = [
  "Question/Hook",
  "Statistic/Insight",
  "Story/Personal",
  "Tip/Actionable",
  "Contrarian/Bold",
]

const PLATFORM_SPECS: Record<SocialPlatform, { maxLength: string; guidelines: string; maxOutputTokens: number }> = {
  linkedin: {
    maxLength: "1,300 characters (about 200-250 words)",
    guidelines: `- Professional yet engaging tone
- Use line breaks for readability
- Include 3-5 relevant hashtags at the end
- Add a clear call-to-action
- Use emojis sparingly but strategically
- Consider starting with a hook or question
- LinkedIn users appreciate insights and professional value`,
    maxOutputTokens: 3000,
  },
  twitter: {
    maxLength: "280 characters total",
    guidelines: `- Concise and punchy
- Use 1-2 hashtags maximum (they count toward character limit)
- Include emojis for engagement
- Strong hook in first 8 words
- Consider thread format if content is complex
- Use Twitter-style language (brief, conversational)`,
    maxOutputTokens: 1500,
  },
  facebook: {
    maxLength: "500-800 characters for best engagement",
    guidelines: `- Conversational and friendly tone
- Use storytelling when possible
- Include 2-3 hashtags
- Ask questions to encourage comments
- Use emojis to break up text
- Facebook users like relatable, human content`,
    maxOutputTokens: 2500,
  },
  instagram: {
    maxLength: "2,200 characters but first 125 characters are crucial",
    guidelines: `- Visual-first platform (mention this content needs an image)
- Start with an engaging first line
- Use line breaks for readability
- Include 5-10 relevant hashtags (can go up to 30)
- Use emojis throughout
- Instagram users love authentic, behind-the-scenes content`,
    maxOutputTokens: 3000,
  },
}

export function platformSpec(platform: SocialPlatform) {
  return PLATFORM_SPECS[platform]
}

export type SocialMediaBrief = {
  content: string
  platform?: SocialPlatform
  tone?: string
  numVariations?: number
  includeHashtags?: boolean
  includeEmojis?: boolean
  callToAction?: boolean
  writingStyle?: WritingStyle
  brandVoice?: BrandVoice
  messaging?: Messaging
}

export function buildSocialMediaSystem(platform: SocialPlatform): string {
  return `You are a social media expert specializing in ${platform}. Create multiple engaging, platform-specific content variations that follow all style guidelines. Return only the post variations with no explanations.`
}

export function buildSocialMediaPrompt(input: SocialMediaBrief): string {
  const platform = input.platform ?? "linkedin"
  const spec = platformSpec(platform)
  const numVariations = input.numVariations ?? 3
  const tone = input.tone ?? "professional"
  const styleInstructions = buildStyleGuideInstructions(input.writingStyle, input.brandVoice, input.messaging)

  return `🚨 STYLE GUIDE COMPLIANCE:
${styleInstructions || "(no style guide configured yet — use clear, natural language)"}

Create ${numVariations} different engaging ${platform} posts based on this content. Each should have a unique angle or approach.

ORIGINAL CONTENT:
${input.content}

PLATFORM: ${platform.toUpperCase()}
MAX LENGTH: ${spec.maxLength}
TONE: ${tone}

PLATFORM GUIDELINES:
${spec.guidelines}

REQUIREMENTS:
- Create ${numVariations} DIFFERENT variations with unique angles
- Each variation should stay within ${spec.maxLength}
- Make each post engaging and scroll-stopping
- ${input.includeHashtags === false ? "No hashtags" : "Include relevant hashtags"}
- ${input.includeEmojis === false ? "No emojis" : "Use emojis strategically"}
- ${input.callToAction === false ? "No call-to-action needed" : "Include a clear call-to-action"}
- Follow the style guide rules exactly
- Remove any markdown formatting

VARIATION APPROACHES (use these for inspiration, in this order):
1. Question/Hook — start with an engaging question
2. Statistic/Insight — lead with a compelling stat or insight
3. Story/Personal — use storytelling or a personal angle
4. Tip/Actionable — focus on actionable advice
5. Contrarian/Bold — challenge conventional thinking

Return exactly ${numVariations} post variations.`
}
