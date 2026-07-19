import { getDb } from "@/lib/mongodb"

// ---------------------------------------------------------------------------
// Company profile — who the user actually is, distinct from BrandProfileDoc
// (which captures how they write). This is the baseline competitive intel
// and SERP monitoring compare against: "what are we competing against" needs
// an answer for "us" as well as the competitor. Single profile per userId,
// same single-user model as BrandProfileDoc (brand-profile.ts).
// ---------------------------------------------------------------------------

export type CompanyProfileDoc = {
  _id?: string
  userId: string
  companyName: string
  websiteUrl: string
  createdAt: Date
  updatedAt: Date
}

export async function upsertCompanyProfile(
  userId: string,
  companyName: string,
  websiteUrl: string
): Promise<CompanyProfileDoc> {
  const db = await getDb()
  const now = new Date()

  const existing = await db.collection<CompanyProfileDoc>("company_profiles").findOne({ userId })

  const doc: CompanyProfileDoc = {
    userId,
    companyName,
    websiteUrl,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.collection<CompanyProfileDoc>("company_profiles").replaceOne({ userId }, doc, { upsert: true })
  return doc
}

export async function getCompanyProfile(userId: string): Promise<CompanyProfileDoc | null> {
  const db = await getDb()
  return db.collection<CompanyProfileDoc>("company_profiles").findOne({ userId })
}

// Normalizes a URL or bare domain down to a comparable hostname, e.g.
// "https://www.skribil.com/pricing" -> "skribil.com". Used to match the
// company's own site against SERP result links and to resolve a
// human-entered website URL to a fetchable https:// URL.
export function normalizeDomain(input: string): string {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "")
  } catch {
    return input.replace(/^www\./, "")
  }
}
