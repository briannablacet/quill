/**
 * POST /api/serp/generate
 *
 * Enqueues a monitor_serp task (lib/agents/serp-monitor.ts). The diff
 * against the previous snapshot for the same keyword lives on the task's
 * result, not the snapshot doc — the client should read it from
 * GET /api/tasks/[taskId] once the task completes.
 */

import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { enqueueTask } from "@/lib/tasks"

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : ""

  if (!keyword) {
    return NextResponse.json({ error: "'keyword' is required" }, { status: 400 })
  }

  const taskId = await enqueueTask(userId, "monitor_serp", { keyword })
  return NextResponse.json({ taskId })
}
