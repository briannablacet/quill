import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { IdeationDoc } from "@/lib/agents/ideation"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ideationId: string }> }) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { ideationId } = await params
  const db = await getDb()
  const item = await db.collection<IdeationDoc>("ideas").findOne({ ideationId, userId })

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(item)
}
