"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { CompetitiveIntelDoc } from "@/lib/agents/competitive-intel"
import { nudgeWorker } from "./types"

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 120 // ~3 minutes — fetches + analyzes several competitor pages sequentially

export function CompetitivePanel({ initialItems }: { initialItems: CompetitiveIntelDoc[] }) {
  const [items, setItems] = useState(initialItems)
  const [keyword, setKeyword] = useState("")
  const [competitors, setCompetitors] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const pollCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const pollIntel = useCallback((intelId: string) => {
    intervalRef.current = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > MAX_POLLS) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setStatus("error")
        setError("Taking longer than expected — check back shortly.")
        return
      }
      nudgeWorker()
      const res = await fetch(`/api/competitive/${intelId}`)
      if (res.ok) {
        const item: CompetitiveIntelDoc = await res.json()
        if (intervalRef.current) clearInterval(intervalRef.current)
        setStatus("idle")
        setItems((prev) => [item, ...prev.filter((i) => i.intelId !== item.intelId)])
        setExpanded(item.intelId)
      }
    }, POLL_INTERVAL_MS)
  }, [])

  const handleSubmit = async () => {
    setError(null)
    setStatus("working")
    pollCount.current = 0

    const competitorList = competitors
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean)

    const res = await fetch("/api/competitive/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: keyword.trim() || undefined,
        competitors: competitorList.length > 0 ? competitorList : undefined,
      }),
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
        setError("Taking longer than expected — check back shortly.")
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
      if (task.status === "done" && typeof task.result?.intelId === "string") {
        if (intervalRef.current) clearInterval(intervalRef.current)
        pollIntel(task.result.intelId)
      }
    }, POLL_INTERVAL_MS)
  }

  const valid = keyword.trim().length > 0 || competitors.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Analyze Competitors</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="keyword">Keyword (discover competitors by search)</Label>
            <Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. SIEM platform" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="competitors">Or named competitors (one per line — name or URL)</Label>
            <Textarea
              id="competitors"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder={"HubSpot\nJasper AI"}
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!valid || status === "working"}>
            {status === "working" ? "Fetching real page content…" : "Analyze"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No competitive analysis run yet.</p>}
        {items.map((item) => (
          <Card key={item.intelId}>
            <CardHeader className="cursor-pointer" onClick={() => setExpanded(expanded === item.intelId ? null : item.intelId)}>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="font-serif">{item.keyword ?? item.requestedCompetitors?.join(", ") ?? "Competitive analysis"}</span>
                <Badge variant="outline">{item.competitors.length} analyzed</Badge>
              </CardTitle>
            </CardHeader>
            {expanded === item.intelId && (
              <CardContent className="flex flex-col gap-4">
                {item.competitors.map((c, i) => (
                  <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-base font-semibold">{c.name}</span>
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
                        {c.url}
                      </a>
                    </div>
                    {c.error ? (
                      <p className="text-sm text-destructive">{c.error}</p>
                    ) : (
                      <>
                        {c.uniquePositioning.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Positioning</span>
                            <ul className="text-sm">
                              {c.uniquePositioning.map((p, j) => (
                                <li key={j}>• {p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {c.gaps.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gaps</span>
                            <ul className="text-sm">
                              {c.gaps.map((g, j) => (
                                <li key={j}>• {g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
