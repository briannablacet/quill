import { redirect } from "next/navigation"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import { IdeasPanel } from "@/components/quill/ideas-panel"
import type { IdeationDoc } from "@/lib/agents/ideation"

export const dynamic = "force-dynamic"

export default async function IdeasPage() {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  const db = await getDb()
  const docs = await db
    .collection("ideas")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  const initialItems: IdeationDoc[] = JSON.parse(JSON.stringify(docs))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <p className="text-[15.5px] text-muted-foreground">
        Suggests what to write next, based on what actually scored well in your real Scorecard data.
      </p>
      <IdeasPanel initialItems={initialItems} />
    </main>
  )
}
