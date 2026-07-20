/**
 * POST /api/assistant/chat
 *
 * The floating assistant's brain — a real tool-calling loop (not a canned
 * FAQ bot) that can actually trigger the same orchestration layer every
 * page's own buttons do. Each tool enqueues a real task via the existing
 * task queue (lib/tasks.ts) — no separate/parallel execution path to
 * trust, and no synchronous long-running work inside this request (which
 * would risk the same function-timeout problem the worker route already
 * had to be fixed for).
 */

import { NextRequest, NextResponse } from "next/server"
import { generateText, tool, stepCountIs } from "ai"
import { z } from "zod"
import { getUserId } from "@/lib/session"
import { enqueueTask, type TaskType } from "@/lib/tasks"

export const maxDuration = 60

const ASSISTANT_SYSTEM = `You are Quill's in-app assistant. You can actually take action inside the app on the user's behalf by calling tools — you are not just answering questions.

You can:
- Write a new blog post (write_blog_post)
- Check Google rankings for a keyword, and where the user's own site ranks if they've set up a company profile (check_rankings)
- Analyze competitor messaging/positioning for a keyword, optionally against specific named competitors (analyze_competitors)
- Suggest new content ideas based on the keywords already being tracked in SERP Monitor (suggest_content_ideas)

These other things exist in Quill but you can't trigger them from chat yet — tell the user which tab to use instead, don't pretend you can do it:
- Landing pages, case studies, social media, and battlecards need structured details a chat message won't reliably capture — point them to the Write tab.
- Reviewing/scoring existing content, and the "Fix This" rewrite action, live on the Edit/Review tab.
- Brand voice, style guide, and company profile live on the Settings page.

When the user asks for something you can do, actually call the tool — don't just describe what you would do instead of doing it. These are real, asynchronous tasks that take anywhere from about 10 seconds to a couple of minutes, so after calling a tool, briefly confirm what you started rather than claiming it's already finished — the app will show the result once it lands. For write_blog_post specifically, don't mention grading or scoring as a separate step the user needs to wait for or hear back about — just confirm the draft is on its way; the page it links to already handles showing the finished, graded result.

Keep replies short and conversational.`

type PerformedAction = { type: TaskType; taskId: string; summary: string }

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages) {
    return NextResponse.json({ error: "'messages' array is required" }, { status: 400 })
  }

  const performedActions: PerformedAction[] = []

  const tools = {
    write_blog_post: tool({
      description: "Write a new blog post on a topic. Enqueues a real generation task — the writer drafts it, then the evaluator grades it automatically.",
      inputSchema: z.object({
        topic: z.string().describe("The blog post topic or title direction"),
        brief: z.string().optional().describe("Additional context: audience, angle, anything to mention"),
      }),
      execute: async ({ topic, brief }: { topic: string; brief?: string }) => {
        const taskId = await enqueueTask(userId, "generate_content", { mode: "blog_post", topic, brief })
        performedActions.push({ type: "generate_content", taskId, summary: `Writing "${topic}"` })
        return { taskId, queued: true }
      },
    }),
    check_rankings: tool({
      description: "Check who currently ranks in Google search for a keyword, and where the user's own site ranks if a company profile is set.",
      inputSchema: z.object({ keyword: z.string().describe("The keyword to check rankings for") }),
      execute: async ({ keyword }: { keyword: string }) => {
        const taskId = await enqueueTask(userId, "monitor_serp", { keyword })
        performedActions.push({ type: "monitor_serp", taskId, summary: `Checking rankings for "${keyword}"` })
        return { taskId, queued: true }
      },
    }),
    analyze_competitors: tool({
      description: "Analyze competitor messaging and positioning for a keyword the user wants to rank for, optionally against specific named competitors. Always includes the user's own site in the comparison if a company profile is set.",
      inputSchema: z.object({
        keyword: z.string().describe("What the user wants to rank for"),
        competitors: z.array(z.string()).optional().describe("Specific competitor names or URLs, if the user named any"),
      }),
      execute: async ({ keyword, competitors }: { keyword: string; competitors?: string[] }) => {
        const taskId = await enqueueTask(userId, "fetch_competitor_content", {
          keyword,
          ...(competitors?.length ? { competitors } : {}),
        })
        performedActions.push({ type: "fetch_competitor_content", taskId, summary: `Analyzing competitors for "${keyword}"` })
        return { taskId, queued: true }
      },
    }),
    suggest_content_ideas: tool({
      description: "Suggest new content ideas targeted at the keywords currently being tracked in SERP Monitor.",
      inputSchema: z.object({}),
      execute: async () => {
        const taskId = await enqueueTask(userId, "suggest_ideas", {})
        performedActions.push({ type: "suggest_ideas", taskId, summary: "Suggesting content ideas" })
        return { taskId, queued: true }
      },
    }),
  }

  const result = await generateText({
    model: "anthropic/claude-sonnet-5",
    system: ASSISTANT_SYSTEM,
    messages,
    tools,
    stopWhen: stepCountIs(4),
  })

  return NextResponse.json({ reply: result.text, actions: performedActions })
}
