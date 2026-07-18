import { redirect } from "next/navigation"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import { CompetitivePanel } from "@/components/quill/competitive-panel"
import type { CompetitiveIntelDoc } from "@/lib/agents/competitive-intel"

export const dynamic = "force-dynamic"

export default async function CompetitivePage() {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  const db = await getDb()
  const docs = await db
    .collection("competitive_intel")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  const initialItems: CompetitiveIntelDoc[] = JSON.parse(JSON.stringify(docs))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <p className="max-w-[58ch] text-[15.5px] text-muted-foreground">
        Fetches real competitor page content and analyzes messaging and positioning — not LLM recall.
      </p>
      <CompetitivePanel initialItems={initialItems} />
    </main>
  )
}
