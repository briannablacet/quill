// Ported from Skribil's api_endpoints.ts (buildStyleGuideInstructions,
// buildToneInstructions — migration.md §2). This is the real, battle-tested
// prompt-composition logic behind Skribil's writing quality, not a
// reimplementation. Shared across every content mode in lib/agents/prompts/.
//
// Skribil wires this from BrandVoiceContext/StyleGuideContext/MessagingContext
// (client-side React state). Quill has no retrieval layer yet (migration.md
// §5 Phase 5) — every field here is optional and simply omitted from the
// instruction block until real style-guide documents exist.

export type WritingStyle = {
  styleGuide?: {
    primary?: string
    customRules?: string[]
  }
  formatting?: {
    headingCase?: "upper" | "lower" | "sentence" | "title" | "custom"
    headings?: string
    headingCustom?: string
    listStyle?: "bullets" | "numbers" | string
    numberFormat?: "numerals" | "words" | string
    dateFormat?: string
    paragraphSpacing?: string
    paragraphIndent?: string
    sectionOrder?: string[]
  }
  punctuation?: {
    oxfordComma?: boolean
    quotationMarks?: "double" | "single"
    bulletPoints?: string
    hyphenation?: string
  }
}

export type BrandVoice = {
  brandVoice?: { tone?: string }
}

export type Messaging = {
  valueProposition?: string
}

export function buildStyleGuideInstructions(
  writingStyle?: WritingStyle,
  brandVoice?: BrandVoice,
  messaging?: Messaging
): string {
  let instructions = ""

  if (writingStyle?.styleGuide?.primary) {
    instructions += `\nFOLLOW ${writingStyle.styleGuide.primary} as the base style guide.`
  }

  if (writingStyle?.formatting) {
    const f = writingStyle.formatting
    if (f.headingCase === "upper" || f.headings === "All caps for main headings") {
      instructions += `\n- ALL MAIN HEADINGS MUST BE IN ALL CAPS.`
    } else if (f.headingCase === "lower") {
      instructions += `\n- All headings must be in lowercase.`
    } else if (f.headingCase === "sentence" || f.headings === "Sentence case") {
      instructions += `\n- Use sentence case for all headings (capitalize only the first word).`
    } else if (f.headingCase === "title" || f.headings === "Title Case") {
      instructions += `\n- Use title case for all headings (capitalize major words).`
    } else if (f.headingCase === "custom" && f.headingCustom) {
      instructions += `\n- Headings: ${f.headingCustom}`
    }

    if (f.listStyle === "bullets") {
      instructions += `\n- Use bullet points for all lists.`
    } else if (f.listStyle === "numbers") {
      instructions += `\n- Use numbered lists for all lists.`
    } else if (typeof f.listStyle === "string" && f.listStyle) {
      instructions += `\n- List style: ${f.listStyle}`
    }

    if (f.numberFormat === "numerals") {
      instructions += `\n- NUMBERS: Use numerals for ALL numbers (1, 2, 3, 10, 100, etc.).`
    } else if (f.numberFormat === "words") {
      instructions += `\n- NUMBERS: Spell out all numbers as words (one, two, three, ten, etc.).`
    } else if (typeof f.numberFormat === "string" && f.numberFormat) {
      instructions += `\n- Number format: ${f.numberFormat}`
    }

    if (f.dateFormat) instructions += `\n- DATE FORMAT: Use ${f.dateFormat} for all dates.`
    if (f.paragraphSpacing) instructions += `\n- Add ${f.paragraphSpacing} between paragraphs.`
    if (f.paragraphIndent) instructions += `\n- Indent each paragraph by ${f.paragraphIndent}.`
    if (f.sectionOrder?.length) {
      instructions += `\n- SECTION ORDER: The content must follow this exact section order: ${f.sectionOrder.join(" > ")}.`
    }
  }

  if (writingStyle?.punctuation) {
    const p = writingStyle.punctuation
    if (p.oxfordComma !== undefined) {
      instructions += `\n- Oxford comma: ${p.oxfordComma ? "ALWAYS use" : "NEVER use"}`
    }
    if (p.quotationMarks) {
      instructions += `\n- Use ${p.quotationMarks === "double" ? "double" : "single"} quotation marks for all quotes.`
    }
    if (p.bulletPoints) instructions += `\n- Bullet points: ${p.bulletPoints}`
    if (p.hyphenation) instructions += `\n- Hyphenation: ${p.hyphenation}`
  }

  writingStyle?.styleGuide?.customRules?.forEach((rule) => {
    instructions += `\n- ${rule}`
  })

  if (brandVoice?.brandVoice?.tone) instructions += `\n- Tone: ${brandVoice.brandVoice.tone}`
  if (messaging?.valueProposition) instructions += `\n- Value Proposition: ${messaging.valueProposition}`

  if (!instructions) return ""

  instructions += `\n\n🚨 STRICT COMPLIANCE: If you do not follow ALL the above layout, formatting, and style rules EXACTLY, your output will be rejected. Do NOT add, remove, or reorder sections. Do NOT use any formatting not specified above. Do NOT improvise.`

  return instructions
}

export function buildToneInstructions(tone = "professional", style = "", mood = ""): string {
  const shouldBeHumorous = tone === "humorous" || style === "comedy" || mood === "funny"

  return shouldBeHumorous
    ? `
TONE: HUMOROUS & ENTERTAINING
Make this genuinely funny and entertaining, not just informative with jokes bolted on:
- Start with an attention-grabbing funny story or analogy
- Use wit and relevant in-jokes for the audience
- Use sarcastic and witty section headings
- Include callbacks throughout
- End with a humorous conclusion
Make it FUNNY FIRST, informative second.
`
    : `
TONE: PROFESSIONAL & ENGAGING
You are a professional magazine writer. Write a compelling article that:
- Uses clear, professional language
- Maintains an authoritative but approachable tone
- Focuses on valuable insights and practical advice
- Keeps the reader engaged with relevant examples
`
}
