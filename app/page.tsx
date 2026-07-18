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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-[34px] font-semibold tracking-tight">Quill</span>
          <span className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Content Studio</span>
        </div>
        <p className="mt-2 max-w-[58ch] text-[15.5px] text-muted-foreground">
          An agentic content marketing operating system — it writes, grades, and rewrites its own drafts.
        </p>
      </div>
      <Workspace initialContent={initialContent} />
    </main>
  )
}
