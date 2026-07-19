import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getBrandProfile, ingestBrandProfile, type StyleGuidePreset } from "@/lib/agents/brand-profile"

const VALID_PRESETS: StyleGuidePreset[] = ["chicago", "ap", "apa"]

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getBrandProfile(userId)
  return NextResponse.json({ profile })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const messagingText = typeof body?.messagingText === "string" ? body.messagingText.trim() : ""
  const styleGuidePreset = body?.styleGuidePreset as StyleGuidePreset

  if (!messagingText) {
    return NextResponse.json({ error: "'messagingText' is required" }, { status: 400 })
  }
  if (!VALID_PRESETS.includes(styleGuidePreset)) {
    return NextResponse.json({ error: `'styleGuidePreset' must be one of: ${VALID_PRESETS.join(", ")}` }, { status: 400 })
  }

  const sourceDocuments = Array.isArray(body?.sourceDocuments)
    ? body.sourceDocuments.filter((d: unknown) => typeof d === "string")
    : []

  try {
    const profile = await ingestBrandProfile(userId, messagingText, styleGuidePreset, sourceDocuments)
    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
