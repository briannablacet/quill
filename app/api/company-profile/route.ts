import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getCompanyProfile, upsertCompanyProfile } from "@/lib/agents/company-profile"

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getCompanyProfile(userId)
  return NextResponse.json({ profile })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : ""
  const websiteUrl = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : ""

  if (!companyName || !websiteUrl) {
    return NextResponse.json({ error: "'companyName' and 'websiteUrl' are required" }, { status: 400 })
  }

  const profile = await upsertCompanyProfile(userId, companyName, websiteUrl)
  return NextResponse.json({ profile })
}
