import { redirect } from "next/navigation"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import { Workspace } from "@/components/quill/workspace"
import type { ContentItem } from "@/components/quill/types"

export const dynamic = "force-dynamic"

export default async function Page() {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  const db = await getDb()
  const docs = await db
    .collection("content")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  const initialContent: ContentItem[] = JSON.parse(JSON.stringify(docs))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-4 pb-10">
      <div className="flex flex-col gap-3">
        <p className="text-[15.5px] text-muted-foreground">
          Quill is an agentic content marketing system: it writes a draft, grades it against a real Content Quality
          Scorecard, and automatically rewrites anything that scores too low — no human review step required before
          that correction happens. Everything below is real: a task queue, a writer agent, and an evaluator agent
          that catches and fixes its own mistakes.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Content Studio</span> (this page) — write new content, or
            paste in something written elsewhere to grade it against the same Scorecard.
          </li>
          <li>
            <span className="font-medium text-foreground">Competitive Market Analysis</span> — see how your own site
            stacks up against whoever's actually ranking for a keyword you care about.
          </li>
          <li>
            <span className="font-medium text-foreground">SERP Monitor</span> — check who ranks for a keyword and
            track how that changes over time.
          </li>
          <li>
            <span className="font-medium text-foreground">Ideas</span> — get content ideas targeted at the keywords
            you're actually tracking in SERP Monitor.
          </li>
          <li>
            <span className="font-medium text-foreground">Settings</span> — tell Quill your company and brand voice
            so every generated piece and every competitive check reflects it.
          </li>
        </ul>
      </div>
      <Workspace initialContent={initialContent} />
    </main>
  )
}
