/**
 * POST /api/content/generate
 *
 * Enqueues a generate_content task for the signed-in user. The worker
 * (/api/worker) picks it up on its next tick; the result lands in the
 * `content` collection, never localStorage (migration.md §2, §4).
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { enqueueTask } from "@/lib/tasks"
import type { ContentMode } from "@/lib/agents/writer"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const mode: ContentMode = body?.mode === "taglines" ? "taglines" : "blog_post"

  let taskId: string

  if (mode === "taglines") {
    if (typeof body?.businessName !== "string" || !body.businessName.trim() ||
        typeof body?.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ error: "'businessName' and 'description' are required for taglines" }, { status: 400 })
    }
    taskId = await enqueueTask(session.user.id, "generate_content", {
      mode: "taglines",
      businessName: body.businessName,
      description: body.description,
      numOptions: typeof body.numOptions === "number" ? body.numOptions : undefined,
    })
  } else {
    if (typeof body?.topic !== "string" || !body.topic.trim()) {
      return NextResponse.json({ error: "'topic' is required" }, { status: 400 })
    }
    // Optional fields feed Skribil's ported style-guide/tone prompt logic
    // (lib/agents/prompts/style-guide.ts). None are required yet — Quill has
    // no retrieval layer for writingStyle/brandVoice/messaging until Phase 5
    // (migration.md §5), so these are simply omitted from the prompt if absent.
    taskId = await enqueueTask(session.user.id, "generate_content", {
      topic: body.topic,
      mode,
      brief: typeof body.brief === "string" ? body.brief : undefined,
      targetAudience: typeof body.targetAudience === "string" ? body.targetAudience : undefined,
      callToAction: typeof body.callToAction === "string" ? body.callToAction : undefined,
      tone: typeof body.tone === "string" ? body.tone : undefined,
      style: typeof body.style === "string" ? body.style : undefined,
      mood: typeof body.mood === "string" ? body.mood : undefined,
    })
  }

  return NextResponse.json({ taskId, status: "queued" })
}
