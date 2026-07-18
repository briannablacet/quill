/**
 * GET /api/tasks/[taskId]
 *
 * Polled by the UI right after enqueueing a generate_content task, to learn
 * the contentId once the worker picks it up and finishes (result.contentId).
 */

import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { taskId } = await params
  const db = await getDb()
  const task = await db.collection<TaskDoc>("tasks").findOne({ taskId, userId })

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(task)
}
