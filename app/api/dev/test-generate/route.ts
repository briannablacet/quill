/**
 * GET /api/dev/test-generate
 *
 * DEV-ONLY smoke test for Phase 1+2+4: enqueues a real generate_content
 * task for a fixed test user, then drives the worker loop inline until
 * everything settles — including any chain of follow-ups the orchestrator
 * decides to enqueue (score_content after generate_content, and a
 * regeneration after a low score_content — migration.md §5 Phase 2 & 4).
 * Bypasses better-auth (not wired up locally yet) so the full queue ->
 * worker -> writer -> evaluator -> orchestrator -> Mongo loop can be
 * verified without standing up Postgres first.
 *
 * Delete this route once auth is wired up for real testing.
 */

import { NextRequest, NextResponse } from "next/server"
import { enqueueTask, claimNextTask, completeTask, failTask } from "@/lib/tasks"
import { runTask, enqueueFollowUps } from "@/lib/agents"
import { getDb } from "@/lib/mongodb"
import type { ContentDoc } from "@/lib/agents/writer"

export const maxDuration = 300

const TEST_USER_ID = "dev-test-user"
const MAX_TICKS = 8

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "blog_post"

  const TEST_PAYLOADS: Record<string, Record<string, unknown>> = {
    taglines: {
      mode: "taglines",
      businessName: "Quill",
      description: "An ambient agentic content marketing operating system that writes, grades, and improves content on its own.",
    },
    social_media: {
      mode: "social_media",
      platform: "linkedin",
      content:
        "Quill is an agentic content marketing system. It generates a draft, grades its own work against explicit criteria, and rewrites anything that scores below 90 — without a human in the loop.",
      numVariations: 3,
    },
    landing_page: {
      mode: "landing_page",
      title: "Content That Grades Its Own Work",
      goal: "Get technical marketing leads to request a demo",
      callToAction: "Request a demo",
      bullets: [
        "Every draft gets a Content Quality Scorecard before you ever see it",
        "Low-scoring drafts get rewritten automatically, with the specific fix folded in",
        "Nothing is stored in localStorage — every piece is a real, durable document",
      ],
    },
    case_study: {
      mode: "case_study",
      customerName: "Brianna Blacet",
      customerRole: "Builder",
      company: "Quill",
      problem: "Needed to prove an agentic content system could catch and fix its own mistakes, not just generate text.",
      solution: "Built a task queue, a writer agent, and an evaluator agent whose grading automatically triggers a rewrite when a draft scores below 90.",
      results: "A real draft scored 83/100, was automatically rewritten based on the evaluator's specific feedback, and the second draft scored 93/100 with zero human involvement.",
    },
    battlecard: {
      mode: "battlecard",
      competitor: "Salesforce Agentforce",
      positioning:
        "Quill is an ambient agentic content marketing system: it writes a draft, grades it against explicit criteria with a Content Quality Scorecard, and automatically rewrites anything that scores below 90 — with no human review step required before that correction happens.",
      ourAdvantages:
        "Every generated piece is stored as a real database document, never localStorage. The evaluator's grading criteria are mode-specific (a landing page and a case study are graded on different, real requirements, not one generic checklist).",
    },
  }

  await enqueueTask(
    TEST_USER_ID,
    "generate_content",
    TEST_PAYLOADS[mode] ?? {
      topic: "Why most AI agent demos are actually just chatbots with extra steps",
      brief:
        "Written for a technical marketing audience. Make the case that a real agent has to autonomously decide what work to do next, not just respond to a single prompt.",
    }
  )

  // Drive the worker loop inline (instead of waiting for the cron tick),
  // including any chain of follow-up tasks the orchestrator enqueues.
  const ran: { taskId: string; type: string; status: "done" | "failed" }[] = []
  const contentIds = new Set<string>()

  for (let i = 0; i < MAX_TICKS; i++) {
    const claimed = await claimNextTask()
    if (!claimed) break

    try {
      const result = await runTask(claimed)
      await completeTask(claimed.taskId, result)
      await enqueueFollowUps(claimed, result)
      ran.push({ taskId: claimed.taskId, type: claimed.type, status: "done" })
      if (typeof result.contentId === "string") contentIds.add(result.contentId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      await failTask(claimed, message)
      ran.push({ taskId: claimed.taskId, type: claimed.type, status: "failed" })
      return NextResponse.json({ error: message, ran }, { status: 500 })
    }
  }

  if (contentIds.size === 0) {
    return NextResponse.json({ error: "generate_content never ran", ran }, { status: 500 })
  }

  const db = await getDb()
  const drafts = await db
    .collection<ContentDoc>("content")
    .find({ contentId: { $in: [...contentIds] } })
    .sort({ createdAt: 1 })
    .toArray()

  return NextResponse.json({ ran, drafts })
}
