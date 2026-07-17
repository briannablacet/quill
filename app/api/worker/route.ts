/**
 * GET /api/worker
 *
 * Ticked by Vercel Cron every minute. Claims a small batch of queued tasks,
 * runs each through the agent dispatcher, and records the result. Each tick
 * does a bounded amount of work, which is what keeps this off the 300-second
 * ceiling that broke the old single-shot pipeline (see migration.md §1.4).
 */

import { NextRequest, NextResponse } from "next/server"
import { claimNextTask, completeTask, failTask } from "@/lib/tasks"
import { runTask, enqueueFollowUps } from "@/lib/agents"

export const maxDuration = 60

const BATCH_SIZE = 5

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const results: { taskId: string; type: string; status: "done" | "failed" }[] = []

  for (let i = 0; i < BATCH_SIZE; i++) {
    const task = await claimNextTask()
    if (!task) break

    try {
      const result = await runTask(task)
      await completeTask(task.taskId, result)
      await enqueueFollowUps(task, result)
      results.push({ taskId: task.taskId, type: task.type, status: "done" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      await failTask(task, message)
      results.push({ taskId: task.taskId, type: task.type, status: "failed" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
