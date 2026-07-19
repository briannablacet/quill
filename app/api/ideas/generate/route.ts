/**
 * POST /api/ideas/generate
 *
 * Enqueues a suggest_ideas task (lib/agents/ideation.ts) — works from real
 * SERP monitoring data (the keywords being tracked and who's currently
 * ranking for them), not the Scorecard.
 */

import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { enqueueTask } from "@/lib/tasks"

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const numIdeas = typeof body?.numIdeas === "number" ? body.numIdeas : undefined

  const taskId = await enqueueTask(userId, "suggest_ideas", {
    ...(numIdeas ? { numIdeas } : {}),
  })

  return NextResponse.json({ taskId })
}
