/**
 * POST /api/content/upload
 *
 * Takes content written outside Quill (pasted or extracted client-side from
 * an uploaded file) and scores it against the same Content Quality
 * Scorecard used for generated drafts — reviewing/editing someone else's
 * work, not just grading Quill's own output. Creates the ContentDoc
 * directly (there's nothing to generate) and enqueues a score_content task
 * against it, same as the orchestrator does after a real generation.
 */

import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import { enqueueTask } from "@/lib/tasks"
import type { ContentDoc, ContentMode } from "@/lib/agents/writer"

const SCORABLE_MODES: ContentMode[] = ["blog_post", "landing_page", "case_study"]

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const mode = body?.mode as ContentMode | undefined
  const topic = str(body?.topic)
  const text = str(body?.body)

  if (!mode || !SCORABLE_MODES.includes(mode)) {
    return NextResponse.json({ error: `'mode' must be one of: ${SCORABLE_MODES.join(", ")}` }, { status: 400 })
  }
  if (!topic) {
    return NextResponse.json({ error: "'topic' is required" }, { status: 400 })
  }
  if (!text) {
    return NextResponse.json({ error: "'body' is required" }, { status: 400 })
  }

  const meta: Record<string, string> = {}
  if (mode === "landing_page") {
    const callToAction = str(body?.callToAction)
    if (!callToAction) {
      return NextResponse.json({ error: "'callToAction' is required for landing_page" }, { status: 400 })
    }
    meta.callToAction = callToAction
  }
  if (mode === "case_study") {
    const sourceFacts = str(body?.sourceFacts)
    if (sourceFacts) meta.sourceFacts = sourceFacts
  }

  const db = await getDb()
  const contentId = randomUUID()
  const now = new Date()

  const taskId = await enqueueTask(userId, "score_content", { contentId })

  await db.collection<ContentDoc>("content").insertOne({
    contentId,
    userId,
    mode,
    topic,
    body: text,
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
    origin: "uploaded",
    status: "draft",
    sourceTaskId: taskId,
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ taskId, contentId })
}
