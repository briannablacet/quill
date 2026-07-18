import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { CompetitiveIntelDoc } from "@/lib/agents/competitive-intel"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ intelId: string }> }) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { intelId } = await params
  const db = await getDb()
  const item = await db.collection<CompetitiveIntelDoc>("competitive_intel").findOne({ intelId, userId })

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(item)
}
