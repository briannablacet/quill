import { randomUUID } from "crypto"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import { searchGoogle, type OrganicResult } from "./serper"
import { getCompanyProfile, normalizeDomain } from "./company-profile"

// ---------------------------------------------------------------------------
// SERP monitor agent — monitor_serp task handler.
// See migration.md §5 Phase 5. Shares its data source with the competitive
// intel agent (competitive-intel.ts) — same searchGoogle() call — but
// presents it differently: instead of analyzing what ranking pages say,
// this tracks *who* ranks and *whether that changed* since the last check,
// which is what "SERP monitoring" actually means (detecting movement, not
// just reading content).
// ---------------------------------------------------------------------------

export type SerpResultSnapshot = {
  position: number
  title: string
  link: string
}

export type SerpSnapshotDoc = {
  _id?: string
  snapshotId: string
  userId: string
  keyword: string
  results: SerpResultSnapshot[]
  // The user's own domain (from their company profile) and where it landed
  // in this snapshot's results, if it appeared at all — this is what makes
  // "SERP monitoring" answer "where do I rank," not just "who's up there."
  ownDomain?: string
  ownPosition?: number | null
  capturedAt: Date
}

export type SerpChange = {
  link: string
  title: string
  type: "new" | "dropped" | "moved"
  previousPosition?: number
  currentPosition?: number
}

function diffSnapshots(previous: SerpResultSnapshot[], current: SerpResultSnapshot[]): SerpChange[] {
  const changes: SerpChange[] = []
  const prevByLink = new Map(previous.map((r) => [r.link, r]))
  const currByLink = new Map(current.map((r) => [r.link, r]))

  for (const curr of current) {
    const prev = prevByLink.get(curr.link)
    if (!prev) {
      changes.push({ link: curr.link, title: curr.title, type: "new", currentPosition: curr.position })
    } else if (prev.position !== curr.position) {
      changes.push({
        link: curr.link,
        title: curr.title,
        type: "moved",
        previousPosition: prev.position,
        currentPosition: curr.position,
      })
    }
  }

  for (const prev of previous) {
    if (!currByLink.has(prev.link)) {
      changes.push({ link: prev.link, title: prev.title, type: "dropped", previousPosition: prev.position })
    }
  }

  return changes
}

type MonitorSerpPayload = {
  keyword: string
}

export async function monitorSerp(task: TaskDoc): Promise<Record<string, unknown>> {
  const { keyword } = task.payload as MonitorSerpPayload

  if (!keyword || typeof keyword !== "string") {
    throw new Error("monitor_serp task requires a non-empty 'keyword' in payload")
  }

  const db = await getDb()
  const snapshots = db.collection<SerpSnapshotDoc>("serp_snapshots")

  const previous = await snapshots
    .find({ userId: task.userId, keyword })
    .sort({ capturedAt: -1 })
    .limit(1)
    .toArray()

  const searchResults = await searchGoogle(keyword)
  const current: SerpResultSnapshot[] = searchResults.organic.map((r: OrganicResult) => ({
    position: r.position,
    title: r.title,
    link: r.link,
  }))

  const changes = previous.length > 0 ? diffSnapshots(previous[0].results, current) : []

  const companyProfile = await getCompanyProfile(task.userId)
  const ownDomain = companyProfile ? normalizeDomain(companyProfile.websiteUrl) : undefined
  const ownResult = ownDomain ? current.find((r) => normalizeDomain(r.link) === ownDomain) : undefined
  const ownPosition = ownDomain ? ownResult?.position ?? null : undefined

  const snapshotId = randomUUID()
  const now = new Date()

  await snapshots.insertOne({
    snapshotId,
    userId: task.userId,
    keyword,
    results: current,
    ...(ownDomain ? { ownDomain, ownPosition } : {}),
    capturedAt: now,
  })

  return {
    snapshotId,
    keyword,
    isFirstSnapshot: previous.length === 0,
    resultCount: current.length,
    changeCount: changes.length,
    changes,
    ...(ownDomain ? { ownDomain, ownPosition } : {}),
  }
}
