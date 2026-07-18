import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { SerpSnapshotDoc } from "@/lib/agents/serp-monitor"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ snapshotId: string }> }) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { snapshotId } = await params
  const db = await getDb()
  const item = await db.collection<SerpSnapshotDoc>("serp_snapshots").findOne({ snapshotId, userId })

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(item)
}
