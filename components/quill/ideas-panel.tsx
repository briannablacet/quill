"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MODE_LABEL, nudgeWorker } from "./types"
import { AgentNote } from "./agent-note"
import type { IdeationDoc } from "@/lib/agents/ideation"

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 60 // ~1.5 minutes — one generateObject call

export function IdeasPanel({ initialItems }: { initialItems: IdeationDoc[] }) {
  const [items, setItems] = useState(initialItems)
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const pollCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const handleSubmit = async () => {
    setError(null)
    setStatus("working")
    pollCount.current = 0

    const res = await fetch("/api/ideas/generate", { method: "POST" })
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
      if (task.status === "done" && typeof task.result?.ideationId === "string") {
        if (intervalRef.current) clearInterval(intervalRef.current)
        const itemRes = await fetch(`/api/ideas/${task.result.ideationId}`)
        if (itemRes.ok) {
          const item: IdeationDoc = await itemRes.json()
          setItems((prev) => [item, ...prev])
        }
        setStatus("idle")
      }
    }, POLL_INTERVAL_MS)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Suggest Ideas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Works from real SERP data — the keywords you're tracking in SERP Monitor and who's currently ranking for
            them — not the Scorecard, which grades writing quality, not what's worth writing next.
          </p>
          <Button onClick={handleSubmit} disabled={status === "working"}>
            {status === "working" ? "Thinking…" : "Suggest Ideas"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No ideas generated yet.</p>}
        {items.map((item) => (
          <Card key={item.ideationId}>
            <CardContent className="flex flex-col gap-3 pt-4">
              {item.ideas.map((idea, i) => (
                <div key={i} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-base font-semibold">{idea.topic}</span>
                    <Badge variant="outline">{MODE_LABEL[idea.mode]}</Badge>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Targeting: &ldquo;{idea.targetKeyword}&rdquo;</span>
                  <p className="text-sm text-muted-foreground">{idea.rationale}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <AgentNote>Ideation agent</AgentNote>
    </div>
  )
}
