/**
 * POST /api/competitive/generate
 *
 * Enqueues a fetch_competitor_content task — either keyword-discovery mode
 * or named-competitor mode (lib/agents/competitive-intel.ts).
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
  const keyword = typeof body?.keyword === "string" && body.keyword.trim() ? body.keyword.trim() : undefined
  const competitors = Array.isArray(body?.competitors)
    ? body.competitors.filter((c: unknown) => typeof c === "string" && c.trim())
    : undefined

  if (!keyword && (!competitors || competitors.length === 0)) {
    return NextResponse.json({ error: "Provide either a 'keyword' or a 'competitors' list" }, { status: 400 })
  }

  const taskId = await enqueueTask(userId, "fetch_competitor_content", {
    ...(keyword ? { keyword } : {}),
    ...(competitors ? { competitors } : {}),
  })

  return NextResponse.json({ taskId })
}
