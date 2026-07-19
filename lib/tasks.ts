import { randomUUID } from "crypto"
import { getDb } from "@/lib/mongodb"

// ---------------------------------------------------------------------------
// Task queue — DB-backed, no new infra (Mongo `tasks` collection).
// See migration.md §4/§5 Phase 1.
// ---------------------------------------------------------------------------

export type TaskType =
  | "generate_content"
  | "score_content"
  | "revise_content"
  | "fetch_competitor_content"
  | "monitor_serp"
  | "analyze_performance"
  | "suggest_ideas"

export type TaskStatus = "queued" | "running" | "done" | "failed"

export type TaskDoc = {
  _id?: string
  taskId: string
  userId: string
  type: TaskType
  payload: Record<string, unknown>
  status: TaskStatus
  attempts: number
  maxAttempts: number
  nextAttemptAt: Date
  result?: Record<string, unknown>
  error?: string
  createdAt: Date
  updatedAt: Date
}

const COLLECTION = "tasks"

// A task claimed but not completed within this window is assumed to belong
// to a crashed/timed-out worker and becomes reclaimable again.
const STALE_RUNNING_MS = 5 * 60 * 1000

function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, 5 * 60 * 1000) // cap at 5 min
}

export async function enqueueTask(
  userId: string,
  type: TaskType,
  payload: Record<string, unknown>,
  maxAttempts = 3
): Promise<string> {
  const db = await getDb()
  const taskId = randomUUID()
  const now = new Date()
  await db.collection<TaskDoc>(COLLECTION).insertOne({
    taskId,
    userId,
    type,
    payload,
    status: "queued",
    attempts: 0,
    maxAttempts,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  })
  return taskId
}

// Atomically claim the oldest eligible task (queued-and-due, or running-and-stale)
// and mark it running. findOneAndUpdate is the atomic primitive — two workers
// racing on the same tick can never both claim the same task.
export async function claimNextTask(): Promise<TaskDoc | null> {
  const db = await getDb()
  const now = new Date()
  const staleThreshold = new Date(now.getTime() - STALE_RUNNING_MS)

  const task = await db.collection<TaskDoc>(COLLECTION).findOneAndUpdate(
    {
      $or: [
        { status: "queued", nextAttemptAt: { $lte: now } },
        { status: "running", updatedAt: { $lte: staleThreshold } },
      ],
    },
    { $set: { status: "running", updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, returnDocument: "after" }
  )

  return task ?? null
}

export async function completeTask(taskId: string, result: Record<string, unknown>): Promise<void> {
  const db = await getDb()
  await db.collection<TaskDoc>(COLLECTION).updateOne(
    { taskId },
    { $set: { status: "done", result, updatedAt: new Date() }, $unset: { error: "" } }
  )
}

export async function failTask(task: TaskDoc, error: string): Promise<void> {
  const db = await getDb()
  const exhausted = task.attempts >= task.maxAttempts
  const now = new Date()
  await db.collection<TaskDoc>(COLLECTION).updateOne(
    { taskId: task.taskId },
    {
      $set: {
        status: exhausted ? "failed" : "queued",
        error,
        updatedAt: now,
        nextAttemptAt: new Date(now.getTime() + backoffMs(task.attempts)),
      },
    }
  )
}
