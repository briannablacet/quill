import { NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { IdeationDoc } from "@/lib/agents/ideation"

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = await getDb()
  const items = await db
    .collection<IdeationDoc>("ideas")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return NextResponse.json({ items })
}
