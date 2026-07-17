// Extracted from Skribil's api_endpoints.ts handleCaseStudyGeneration (§2).
// The most anti-hallucination-focused prompt in the corpus: structured factual
// fields only, repeated explicit bans on inventing names/stats/quotes, and a
// deliberately low temperature (0.2, vs. 0.3-0.8 elsewhere) specifically to
// suppress fabrication. All kept as-is — this is the actual mechanism that
// makes case studies safe to generate from sparse input.

import { buildStyleGuideInstructions, buildToneInstructions, type WritingStyle, type BrandVoice, type Messaging } from "./style-guide"

export const CASE_STUDY_SYSTEM =
  "You are a professional case study writer. You use only the facts you are given and never invent details, statistics, or quotes."

export const CASE_STUDY_TEMPERATURE = 0.2

export type CaseStudyBrief = {
  customerName: string
  customerRole: string
  problem: string
  solution: string
  results: string
  company?: string
  quote?: string
  quoteSpeaker?: string
  additionalDetails?: string
  tone?: string
  style?: string
  mood?: string
  writingStyle?: WritingStyle
  brandVoice?: BrandVoice
  messaging?: Messaging
}

export function buildCaseStudyPrompt(input: CaseStudyBrief): string {
  const customerName = input.customerName.trim()
  const customerRole = input.customerRole.trim()
  const company = input.company?.trim() ?? ""
  const problem = input.problem.trim()
  const solution = input.solution.trim()
  const results = input.results.trim()
  const quote = input.quote?.trim() ?? ""
  const quoteSpeaker = input.quoteSpeaker?.trim() ?? ""
  const additionalDetails = input.additionalDetails?.trim() ?? ""

  const toneInstructions = buildToneInstructions(input.tone, input.style, input.mood)
  const styleInstructions = buildStyleGuideInstructions(input.writingStyle, input.brandVoice, input.messaging)

  return `Create a professional case study using ONLY the factual information provided. Do NOT add fictional details, statistics, or quotes.

########################################
### FACTUAL INFORMATION PROVIDED
########################################

CUSTOMER: ${customerName}
ROLE/TITLE: ${customerRole}
${company ? `COMPANY/INDUSTRY: ${company}` : ""}
PROBLEM/CHALLENGE: ${problem}
SOLUTION PROVIDED: ${solution}
RESULTS ACHIEVED: ${results}
${quote ? `CUSTOMER QUOTE: "${quote}"` : ""}
${quoteSpeaker ? `QUOTE ATTRIBUTION: ${quoteSpeaker}` : ""}
${additionalDetails ? `ADDITIONAL CONTEXT: ${additionalDetails}` : ""}

########################################
### CRITICAL REQUIREMENTS
########################################

1. Use ONLY the facts provided above
2. Do NOT invent or hallucinate:
   - Fake names, locations, or companies
   - Made-up statistics or metrics
   - Fictional quotes or conversations
   - Imaginary timelines or details
3. Do NOT change the customer's name or role
4. Do NOT embellish the results beyond what's stated
5. Do NOT add creative backstory or fictional elements

########################################
### CASE STUDY STRUCTURE
########################################

Create a professional case study with this structure:

**Customer Background**
- Brief introduction of ${customerName}, ${customerRole}${company ? ` at ${company}` : ""}
- Context about their situation (based only on provided details)

**The Challenge**
- Present the problem/challenge exactly as described
- No fictional embellishments or made-up details

**The Solution**
- Describe the solution provided using the exact details given
- Focus on the specific services/tools mentioned

**Results and Impact**
- Present the results exactly as stated
- No invented metrics or exaggerated outcomes
${quote
      ? `
**Customer Testimonial**
"${quote}"
${quoteSpeaker ? `— ${quoteSpeaker}` : `— ${customerName}`}`
      : ""
    }

########################################
### STYLE GUIDELINES
########################################

- Write in a professional, clear tone
- Keep it factual and credible
- Use the customer's real name throughout
- Make it compelling but truthful
- No marketing fluff or exaggerated claims

TONE_AND_STYLE:
${toneInstructions}
${styleInstructions}`
}
