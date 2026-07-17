/**
 * GET /api/dev/test-competitive?type=competitor|serp|ideas&keyword=...
 *
 * DEV-ONLY smoke test for the Phase 5 agents (migration.md §5): competitive
 * intel + SERP monitor (real, live Google searches via Serper — need
 * SERPER_API_KEY) and ideation (works from real Scorecard data already in
 * Mongo, no external dependency). Bypasses better-auth, same as
 * test-generate. Delete before real use.
 */

import { NextRequest, NextResponse } from "next/server"
import { enqueueTask, claimNextTask, completeTask, failTask, type TaskType } from "@/lib/tasks"
import { runTask } from "@/lib/agents"
import { getDb } from "@/lib/mongodb"
import type { IdeationDoc } from "@/lib/agents/ideation"

export const maxDuration = 120

const TEST_USER_ID = "dev-test-user"

const TASK_TYPES: Record<string, TaskType> = {
  competitor: "fetch_competitor_content",
  serp: "monitor_serp",
  ideas: "suggest_ideas",
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const type = req.nextUrl.searchParams.get("type") ?? "serp"
  const taskType = TASK_TYPES[type]
  if (!taskType) {
    return NextResponse.json({ error: `Unknown type '${type}'. Use one of: ${Object.keys(TASK_TYPES).join(", ")}` }, { status: 400 })
  }

  if ((type === "competitor" || type === "serp") && !process.env.SERPER_API_KEY) {
    return NextResponse.json({ error: "SERPER_API_KEY is not set — nothing to test yet" }, { status: 400 })
  }

  const keyword = req.nextUrl.searchParams.get("keyword") ?? "agentic content marketing platform"
  const competitorsParam = req.nextUrl.searchParams.get("competitors") // comma-separated names/URLs

  let payload: Record<string, unknown> = {}
  if (taskType === "suggest_ideas") {
    payload = {}
  } else if (taskType === "fetch_competitor_content" && competitorsParam) {
    payload = { competitors: competitorsParam.split(",").map((c) => c.trim()).filter(Boolean) }
  } else {
    payload = { keyword }
  }

  const contentDb = await getDb()
  await enqueueTask(TEST_USER_ID, taskType, payload)

  const claimed = await claimNextTask()
  if (!claimed) {
    return NextResponse.json({ error: "Could not claim the task" }, { status: 500 })
  }

  try {
    const result = await runTask(claimed)
    await completeTask(claimed.taskId, result)

    if (taskType === "suggest_ideas" && typeof result.ideationId === "string") {
      const ideation = await contentDb.collection<IdeationDoc>("ideas").findOne({ ideationId: result.ideationId })
      return NextResponse.json({ taskId: claimed.taskId, type: claimed.type, result, ideation })
    }

    if (taskType === "fetch_competitor_content" && typeof result.intelId === "string") {
      const intel = await contentDb.collection("competitive_intel").findOne({ intelId: result.intelId })
      return NextResponse.json({ taskId: claimed.taskId, type: claimed.type, result, intel })
    }

    return NextResponse.json({ taskId: claimed.taskId, type: claimed.type, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await failTask(claimed, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
