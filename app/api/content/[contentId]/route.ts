/**
 * GET /api/content/[contentId]
 *
 * Fetches a single content doc for polling. Also resolves whether the
 * orchestrator has already enqueued a regeneration of this draft
 * (migration.md §5 Phase 4) — if so, includes the newer contentId as
 * `regeneratedTo` so the UI can follow the chain to the latest version
 * without the client needing to know about the orchestrator's internals.
 */

import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/session"
import { getDb } from "@/lib/mongodb"
import type { ContentDoc } from "@/lib/agents/writer"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ contentId: string }> }) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contentId } = await params
  const db = await getDb()
  const collection = db.collection<ContentDoc>("content")

  const content = await collection.findOne({ contentId, userId })
  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const regeneration = await collection.findOne({ regeneratedFrom: contentId, userId }, { projection: { contentId: 1 } })

  return NextResponse.json({ ...content, regeneratedTo: regeneration?.contentId ?? null })
}
