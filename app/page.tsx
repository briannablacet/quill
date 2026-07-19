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
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Content Studio</h1>
      <p className="text-[15.5px] text-muted-foreground">
        Writes, grades, and rewrites its own drafts — five content modes, real Scorecard grading, automatic regeneration.
      </p>
      <Workspace initialContent={initialContent} />
    </main>
  )
}
