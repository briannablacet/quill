"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { SerpSnapshotDoc, SerpChange } from "@/lib/agents/serp-monitor"
import { nudgeWorker } from "./types"

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 40 // ~1 minute — a single search + diff, no LLM call

type LastRun = {
  snapshot: SerpSnapshotDoc
  changes: SerpChange[]
  isFirstSnapshot: boolean
  ownDomain?: string
  ownPosition?: number | null
}

export function SerpPanel({ initialItems }: { initialItems: SerpSnapshotDoc[] }) {
  const [items, setItems] = useState(initialItems)
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const pollCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const handleSubmit = async () => {
    setError(null)
    setStatus("working")
    setLastRun(null)
    pollCount.current = 0

    const res = await fetch("/api/serp/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: keyword.trim() }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to start")
      setStatus("error")
      return
    }

    const { taskId } = await res.json()

    intervalRef.current = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > MAX_POLLS) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setStatus("error")
        setError("Taking longer than expected.")
        return
      }
      nudgeWorker()
      const taskRes = await fetch(`/api/tasks/${taskId}`)
      if (!taskRes.ok) return
      const task = await taskRes.json()
      if (task.status === "failed") {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setError(task.error ?? "Failed")
        setStatus("error")
        return
      }
      if (task.status === "done" && typeof task.result?.snapshotId === "string") {
        if (intervalRef.current) clearInterval(intervalRef.current)
        const snapRes = await fetch(`/api/serp/${task.result.snapshotId}`)
        if (snapRes.ok) {
          const snapshot: SerpSnapshotDoc = await snapRes.json()
          setItems((prev) => [snapshot, ...prev])
          setLastRun({
            snapshot,
            changes: task.result.changes ?? [],
            isFirstSnapshot: task.result.isFirstSnapshot,
            ownDomain: task.result.ownDomain,
            ownPosition: task.result.ownPosition,
          })
        }
        setStatus("idle")
      }
    }, POLL_INTERVAL_MS)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Check Rankings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serp-keyword">Keyword</Label>
            <Input id="serp-keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. cloud security data lake" />
          </div>
          <Button onClick={handleSubmit} disabled={!keyword.trim() || status === "working"}>
            {status === "working" ? "Checking rankings…" : "Check Rankings"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">{lastRun.snapshot.keyword}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lastRun.ownDomain && (
              <p className="text-sm">
                <span className="font-medium">Your ranking ({lastRun.ownDomain}): </span>
                {lastRun.ownPosition ? `#${lastRun.ownPosition}` : "not in the top results"}
              </p>
            )}
            {lastRun.isFirstSnapshot ? (
              <p className="text-sm text-muted-foreground">First snapshot for this keyword — nothing to compare against yet.</p>
            ) : lastRun.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ranking changes since the last check.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {lastRun.changes.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge variant={c.type === "new" ? "default" : c.type === "dropped" ? "destructive" : "secondary"}>{c.type}</Badge>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current results</span>
              <ol className="text-sm">
                {lastRun.snapshot.results.map((r) => (
                  <li key={r.link} className="truncate">
                    {r.position}. {r.title}
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">History</span>
        {items.length === 0 && <p className="text-sm text-muted-foreground">No snapshots yet.</p>}
        {items.map((item) => (
          <div key={item.snapshotId} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span className="font-serif">{item.keyword}</span>
            <span className="text-xs text-muted-foreground">{new Date(item.capturedAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
