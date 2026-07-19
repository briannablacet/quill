/**
 * POST /api/content/revise
 *
 * Enqueues a revise_content task (lib/agents/reviser.ts) for an already-
 * scored piece of content — the explicit "Fix This" action on Edit/Review.
 * Reuses the fixGuidance the evaluator already produced.
 */

import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import { enqueueTask } from "@/lib/tasks"
import type { ContentDoc } from "@/lib/agents/writer"

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const contentId = typeof body?.contentId === "string" ? body.contentId : ""
  if (!contentId) {
    return NextResponse.json({ error: "'contentId' is required" }, { status: 400 })
  }

  const db = await getDb()
  const content = await db.collection<ContentDoc>("content").findOne({ contentId, userId })
  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!content.fixGuidance || content.fixGuidance.length === 0) {
    return NextResponse.json({ error: "This content has no fix guidance yet — score it first" }, { status: 400 })
  }

  const taskId = await enqueueTask(userId, "revise_content", { contentId })
  return NextResponse.json({ taskId })
}
