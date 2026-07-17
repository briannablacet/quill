import { generateObject } from "ai"
import { getDb } from "@/lib/mongodb"
import {
  brandProfileExtractionSchema,
  BRAND_PROFILE_EXTRACTION_SYSTEM,
  buildBrandProfileExtractionPrompt,
} from "./prompts/brand-profile"
import type { WritingStyle, BrandVoice, Messaging } from "./prompts/style-guide"

// ---------------------------------------------------------------------------
// Brand profile — the retrieval layer (migration.md §5 Phase 5). One real
// document per user, extracted from real style guide + messaging documents
// via generateObject rather than a bespoke parser (see prompts/brand-profile.ts).
// Single user, no multi-tenancy (migration.md §6 decision #1) — one profile
// per userId is sufficient, no need for named/multiple brand profiles yet.
// ---------------------------------------------------------------------------

export type BrandProfileDoc = {
  _id?: string
  userId: string
  brandName: string
  tagline?: string
  boilerplate?: { short?: string; medium?: string; long?: string }
  voice: {
    toneDescription: string
    stylePoints: string[]
    avoidPhrases: string[]
  }
  styleRules: {
    oxfordComma?: boolean
    ctaFormat?: string
    terminology: { term: string; rule: string }[]
    customRules: string[]
  }
  messaging: {
    valueProposition?: string
    keyMessages: string[]
    proofPoints: string[]
  }
  sourceDocuments: string[]
  createdAt: Date
  updatedAt: Date
}

export async function ingestBrandProfile(
  userId: string,
  styleGuideText: string,
  messagingText: string,
  sourceDocuments: string[]
): Promise<BrandProfileDoc> {
  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-5",
    schema: brandProfileExtractionSchema,
    system: BRAND_PROFILE_EXTRACTION_SYSTEM,
    prompt: buildBrandProfileExtractionPrompt(styleGuideText, messagingText),
    temperature: 0.1,
  })

  const db = await getDb()
  const now = new Date()

  const doc: BrandProfileDoc = {
    userId,
    ...object,
    sourceDocuments,
    createdAt: now,
    updatedAt: now,
  }

  // One profile per user — replace any existing one rather than accumulating.
  await db.collection<BrandProfileDoc>("brand_profiles").replaceOne(
    { userId },
    doc,
    { upsert: true }
  )

  return doc
}

export async function getBrandProfile(userId: string): Promise<BrandProfileDoc | null> {
  const db = await getDb()
  return db.collection<BrandProfileDoc>("brand_profiles").findOne({ userId })
}

// Adapts the rich, real BrandProfileDoc into the shape buildStyleGuideInstructions
// / buildToneInstructions already expect (style-guide.ts) — keeps the prompt-
// composition layer unchanged rather than reshaping it around one document type.
export function toPromptInputs(profile: BrandProfileDoc | null): {
  writingStyle?: WritingStyle
  brandVoice?: BrandVoice
  messaging?: Messaging
} {
  if (!profile) return {}

  const customRules = [
    ...profile.voice.stylePoints,
    ...profile.voice.avoidPhrases.map((p) => `Avoid: ${p}`),
    ...profile.styleRules.terminology.map((t) => `"${t.term}": ${t.rule}`),
    ...profile.styleRules.customRules,
    ...(profile.styleRules.ctaFormat ? [`CTA format: ${profile.styleRules.ctaFormat}`] : []),
  ]

  return {
    writingStyle: {
      styleGuide: { primary: profile.brandName, customRules },
      punctuation: { oxfordComma: profile.styleRules.oxfordComma },
    },
    brandVoice: { brandVoice: { tone: profile.voice.toneDescription } },
    messaging: { valueProposition: profile.messaging.valueProposition, keyMessages: profile.messaging.keyMessages },
  }
}
