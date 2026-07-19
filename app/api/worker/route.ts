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

// Total wall-clock ceiling for this invocation, kept under Vercel's 60s
// hard limit so the route can always finish and respond on its own.
const FUNCTION_BUDGET_MS = 55_000

// Hard cap on a single task. Confirmed live (2026-07-19): even with a
// batch-level time budget, one individually slow task (a model call that's
// just having a slow moment) can itself exceed 60s — Vercel then kills the
// whole function mid-write, abandoning the task in "running" forever, since
// it never reaches failTask. Racing runTask() against this timeout means
// OUR code always gets there first: a task that would've overrun instead
// gets recorded as a real failure and retried with backoff, never silently
// stuck.
const TASK_TIMEOUT_MS = 50_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${ms}ms — treating as failed rather than risking the platform killing it mid-write`)),
      ms
    )
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

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
    // Only start another task if there's enough budget left for it to run
    // to its own full timeout without risking the function-level ceiling.
    if (Date.now() - startedAt > FUNCTION_BUDGET_MS - TASK_TIMEOUT_MS) break

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
      const result = await withTimeout(runTask(task), TASK_TIMEOUT_MS, `${task.type} task`)
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
