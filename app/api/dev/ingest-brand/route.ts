/**
 * POST /api/dev/ingest-brand
 * Body: { styleGuideText: string, messagingText: string, sourceDocuments?: string[] }
 *
 * DEV-ONLY ingestion of real style guide + messaging documents into the
 * retrieval layer (migration.md §5 Phase 5, lib/agents/brand-profile.ts).
 * Bypasses better-auth, same as the other dev test routes. Takes raw text
 * directly rather than a file path — paste the extracted document text in.
 *
 * Delete this route once there's a real upload flow with auth.
 */

import { NextRequest, NextResponse } from "next/server"
import { ingestBrandProfile } from "@/lib/agents/brand-profile"

export const maxDuration = 60

const TEST_USER_ID = "dev-test-user"

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.styleGuideText !== "string" || typeof body.messagingText !== "string") {
    return NextResponse.json({ error: "'styleGuideText' and 'messagingText' are required" }, { status: 400 })
  }

  try {
    const profile = await ingestBrandProfile(
      TEST_USER_ID,
      body.styleGuideText,
      body.messagingText,
      Array.isArray(body.sourceDocuments) ? body.sourceDocuments : []
    )
    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
