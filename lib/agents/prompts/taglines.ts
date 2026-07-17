// Extracted from Skribil's api_endpoints.ts handleTaglineGeneration (§2).
// The real technique, kept as-is: generate rough "80% foundations" — short,
// feeling/outcome-driven phrases a human polishes to 100% — rather than
// asking the model for finished taglines directly. The forbidden-words list
// and the post-generation filtering (reject banned words, dedupe by shared
// word) are load-bearing, not incidental, so they're ported alongside the
// prompt rather than left behind as "just prompt work."

export const TAGLINE_FORBIDDEN_WORDS = [
  "revolutionize", "revolutionizing", "revolution",
  "empower", "empowering", "empowerment",
  "master", "mastering", "mastery",
  "unleash", "unleashing", "unchain", "unchaining",
  "evolve", "evolving", "evolution",
  "reinvent", "reinventing",
  "transform", "transforming", "transformation",
  "disrupt", "disrupting", "disruption",
  "unlock", "unlocking",
  "elevate", "elevating",
  "optimize", "optimizing",
  "leverage", "leveraging",
  "synergy", "synergize",
  "paradigm",
  "innovative", "cutting-edge", "next-level", "game-changing", "breakthrough",
  "seamless", "scalable", "robust", "dynamic", "strategic", "holistic",
  "comprehensive", "integrated", "streamlined",
  "maximize", "accelerate", "amplify", "amplified",
]

export const TAGLINE_SYSTEM =
  "You create tagline foundations that humans can easily refine into great taglines. " +
  "Focus on emotions, outcomes, and natural language. Avoid corporate buzzwords. " +
  "Think about how customers want to FEEL, not what the product does. " +
  "Create solid 80% foundations that humans can polish to 100%."

export type TaglineBrief = {
  businessName: string
  description: string
  numOptions?: number
}

export function buildTaglinePrompt({ businessName, description }: TaglineBrief): string {
  return `Generate 20 tagline foundations for ${businessName} that a human can easily polish into perfect taglines.

Business: ${description}

Focus on FEELINGS and OUTCOMES customers want:
- How do they want to FEEL about their business?
- What RESULT do they want to achieve?
- What WORRY do they want to eliminate?
- What would make them confident / proud / successful?

Use these FEELING / TIME concepts that work:
Life, Future, Tomorrow, Today, Finally, Always, Never, Simple, Smart, Better, Right, Sure, Easy, Fast, Clear

GOOD FOUNDATIONS we created by hand:
"Talent for Life" - life concept + outcome
"Tomorrow's Team, Today" - time concept + feeling prepared
"Intelligence at Work" - outcome + action
"See Tomorrow's Hire" - action + future concept
"Data Beats Hunches" - comparison + confidence

These work because they:
- Focus on customer outcomes, not product features
- Use emotional or time-based concepts
- Sound conversational and natural
- Are specific enough to mean something
- Give humans a strong foundation to refine

AVOID:
- Generic business motivation: "Make It Happen", "Act Now"
- Corporate jargon and buzzwords
- Explaining what the product does
- Forced creativity or wordplay

FORBIDDEN WORDS (DO NOT USE):
${TAGLINE_FORBIDDEN_WORDS.join(", ")}

Requirements:
- 2-4 words maximum
- Focus on FEELINGS and OUTCOMES
- Natural, conversational language
- Strong foundation that humans can polish
- Specific to this business type

Return exactly 20 tagline foundations in this format:
"Foundation One"
"Foundation Two"
etc.`
}

function cleanTagline(line: string): string {
  return line.replace(/^["\d.\s-]+|["\s]+$/g, "").trim()
}

// Filters and dedupes raw model output down to `numOptions` clean foundations:
// reject anything containing a forbidden word, then reject anything sharing
// a word with an already-accepted foundation (keeps the final set distinct).
export function parseTaglines(rawText: string, numOptions = 5): string[] {
  const candidates = rawText
    .split("\n")
    .map((line) => cleanTagline(line.trim()))
    .filter((line) => line.length > 0 && line.split(" ").length <= 6)

  const clean = candidates.filter((tagline) => {
    const lower = tagline.toLowerCase()
    return !TAGLINE_FORBIDDEN_WORDS.some((word) => lower.includes(word.toLowerCase()))
  })

  const unique: string[] = []
  const usedWords = new Set<string>()

  for (const tagline of clean) {
    const words = tagline.toLowerCase().split(/\s+/)
    const hasOverlap = words.some((word) => usedWords.has(word))
    if (!hasOverlap && unique.length < 15) {
      unique.push(tagline)
      words.forEach((word) => usedWords.add(word))
    }
  }

  const final = unique.slice(0, numOptions)
  for (const tagline of clean) {
    if (final.length >= numOptions) break
    if (!final.includes(tagline)) final.push(tagline)
  }

  return final
}
