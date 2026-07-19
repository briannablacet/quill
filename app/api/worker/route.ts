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

// Leaves a margin under maxDuration so this route always finishes cleanly
// on its own instead of being killed mid-task by Vercel's hard timeout.
// Without this, a batch of several slow tasks (a full blog generation, a
// multi-competitor analysis) can cumulatively blow past 60s — Vercel then
// kills the function while a task is mid-flight, abandoning it in
// "running" status forever (confirmed live: score_content tasks stuck for
// 20+ minutes, retried repeatedly, never completing — 2026-07-19).
const TIME_BUDGET_MS = 45_000

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const startedAt = Date.now()
  const results: { taskId: string; type: string; status: "done" | "failed" }[] = []

  for (let i = 0; i < BATCH_SIZE; i++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break

    const task = await claimNextTask()
    if (!task) break

    // A task reclaimed after going stale (its previous attempt was killed
    // by the function timeout rather than reaching failTask) can otherwise
    // retry forever, since it never passes through the maxAttempts check
    // in failTask. Cut it off here instead.
    if (task.attempts > task.maxAttempts) {
      await failTask(task, "Exceeded max attempts — likely timed out on every previous attempt without completing")
      results.push({ taskId: task.taskId, type: task.type, status: "failed" })
      continue
    }

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
