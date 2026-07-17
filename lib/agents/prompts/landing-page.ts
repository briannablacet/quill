// Extracted from Skribil's api_endpoints.ts handleLandingPageGeneration (§2).
// Kept as-is: the exact-output-format template and the triple-repeated,
// verbatim CTA enforcement. That repetition looks redundant but it's a real,
// deliberate technique — models drift from exact strings unless told
// multiple times not to — so it's kept rather than "cleaned up" to one line.

import { buildStyleGuideInstructions, buildToneInstructions, type WritingStyle, type BrandVoice, type Messaging } from "./style-guide"

export const LANDING_PAGE_SYSTEM = "You are a direct-response copywriter creating landing pages that convert."

export type LandingPageBrief = {
  title: string
  goal?: string
  callToAction: string
  bullets?: string[]
  additionalDetails?: string
  tone?: string
  style?: string
  mood?: string
  writingStyle?: WritingStyle
  brandVoice?: BrandVoice
  messaging?: Messaging
}

export function buildLandingPagePrompt(input: LandingPageBrief): string {
  const title = input.title.trim()
  const goal = input.goal?.trim() ?? ""
  const callToAction = input.callToAction.trim()
  const additionalDetails = input.additionalDetails?.trim() ?? ""
  const bullets = (input.bullets ?? []).map((b) => b.trim()).filter(Boolean)
  const hasBullets = bullets.length > 0

  const toneInstructions = buildToneInstructions(input.tone, input.style, input.mood)
  const styleInstructions = buildStyleGuideInstructions(input.writingStyle, input.brandVoice, input.messaging)

  return `Create a compelling landing page based on user specifications.

########################################
### USER PROVIDED INFORMATION
########################################

TITLE: ${title}
PAGE GOAL: ${goal || "[Create based on title and context]"}
${hasBullets
      ? `
USER'S SPECIFIC BULLET POINTS (USE EXACTLY AS PROVIDED):
${bullets.map((bullet, i) => `${i + 1}. ${bullet}`).join("\n")}
`
      : `BULLET POINTS: [User did not provide - create 3-4 compelling bullets based on title and goal]`
    }

CRITICAL: The call to action MUST be exactly this text: "${callToAction}"
DO NOT use placeholder text. DO NOT use "[INSERT YOUR CALL TO ACTION HERE]".
The final line must be: ${callToAction}
${additionalDetails ? `\nADDITIONAL CONTEXT: ${additionalDetails}` : ""}

########################################
### EXACT OUTPUT FORMAT
########################################

${title}

[2-3 sentence intro paragraph]

${hasBullets
      ? bullets.map((bullet) => `- ${bullet}. [One explanatory sentence about this point]`).join("\n\n")
      : `- [Bullet 1]. [One explanatory sentence]

- [Bullet 2]. [One explanatory sentence]

- [Bullet 3]. [One explanatory sentence]`
    }

${callToAction}

########################################
### CRITICAL FORMATTING RULES
########################################

- Each bullet ends with a PERIOD before the explanatory text
- Format: "- [bullet point]. [explanatory sentence]"

CRITICAL CTA INSTRUCTION:
The user provided this call to action: "${callToAction}"
You MUST end your response with EXACTLY this text: "${callToAction}"
If you use "[INSERT YOUR CALL TO ACTION HERE]" instead, you have FAILED.
NEVER use placeholder text. NEVER use brackets.
The final line is: ${callToAction}

TONE_AND_STYLE:
${toneInstructions}
${styleInstructions}`
}
