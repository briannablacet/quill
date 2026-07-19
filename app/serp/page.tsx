import { redirect } from "next/navigation"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import { SerpPanel } from "@/components/quill/serp-panel"
import type { SerpSnapshotDoc } from "@/lib/agents/serp-monitor"

export const dynamic = "force-dynamic"

export default async function SerpPage() {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  const db = await getDb()
  const docs = await db
    .collection("serp_snapshots")
    .find({ userId })
    .sort({ capturedAt: -1 })
    .limit(50)
    .toArray()

  const initialItems: SerpSnapshotDoc[] = JSON.parse(JSON.stringify(docs))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">SERP Monitor</h1>
      <p className="text-[15.5px] text-muted-foreground">
        Tracks who ranks for a keyword over time and surfaces what changed since the last check.
      </p>
      <SerpPanel initialItems={initialItems} />
    </main>
  )
}
