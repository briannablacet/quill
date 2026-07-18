/**
 * GET /api/content
 *
 * Lists the signed-in user's generated content, newest first. Used by the
 * homepage history view.
 */

import { NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { ContentDoc } from "@/lib/agents/writer"

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = await getDb()
  const items = await db
    .collection<ContentDoc>("content")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return NextResponse.json({ items })
}
