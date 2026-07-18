/**
 * POST /api/content/generate
 *
 * Enqueues a generate_content task for the signed-in user. The worker
 * (/api/worker, ticked by Vercel Cron every minute) picks it up — this
 * route only validates and enqueues, it never runs the agent inline.
 */

import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { enqueueTask } from "@/lib/tasks"
import type { ContentMode } from "@/lib/agents/writer"

const UI_MODES: ContentMode[] = ["blog_post", "landing_page", "case_study", "social_media", "battlecard"]

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

  if (!mode || !UI_MODES.includes(mode)) {
    return NextResponse.json({ error: `'mode' must be one of: ${UI_MODES.join(", ")}` }, { status: 400 })
  }

  let payload: Record<string, unknown>

  if (mode === "blog_post") {
    if (!str(body.topic)) {
      return NextResponse.json({ error: "'topic' is required" }, { status: 400 })
    }
    payload = {
      mode,
      topic: body.topic,
      brief: str(body.brief),
      tone: str(body.tone),
      style: str(body.style),
      mood: str(body.mood),
    }
  } else if (mode === "landing_page") {
    if (!str(body.title) || !str(body.callToAction)) {
      return NextResponse.json({ error: "'title' and 'callToAction' are required" }, { status: 400 })
    }
    payload = {
      mode,
      title: body.title,
      callToAction: body.callToAction,
      goal: str(body.goal),
      bullets: Array.isArray(body.bullets) ? body.bullets.filter((b: unknown) => typeof b === "string" && b.trim()) : undefined,
      additionalDetails: str(body.additionalDetails),
    }
  } else if (mode === "case_study") {
    if (!str(body.customerName) || !str(body.problem) || !str(body.solution) || !str(body.results)) {
      return NextResponse.json({ error: "'customerName', 'problem', 'solution', and 'results' are required" }, { status: 400 })
    }
    payload = {
      mode,
      customerName: body.customerName,
      customerRole: str(body.customerRole) ?? "",
      company: str(body.company),
      problem: body.problem,
      solution: body.solution,
      results: body.results,
      quote: str(body.quote),
      quoteSpeaker: str(body.quoteSpeaker),
    }
  } else if (mode === "social_media") {
    if (!str(body.content)) {
      return NextResponse.json({ error: "'content' is required" }, { status: 400 })
    }
    payload = {
      mode,
      content: body.content,
      platform: str(body.platform) ?? "linkedin",
      tone: str(body.tone),
      numVariations: typeof body.numVariations === "number" ? body.numVariations : undefined,
    }
  } else {
    // battlecard
    if (!str(body.competitor) || !str(body.positioning)) {
      return NextResponse.json({ error: "'competitor' and 'positioning' are required" }, { status: 400 })
    }
    payload = {
      mode,
      competitor: body.competitor,
      positioning: body.positioning,
      ourAdvantages: str(body.ourAdvantages),
    }
  }

  const taskId = await enqueueTask(userId, "generate_content", payload)
  return NextResponse.json({ taskId })
}
