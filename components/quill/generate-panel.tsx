"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeFormFields, buildPayload, isFormValid } from "./mode-fields"
import { ScorecardView } from "./scorecard-view"
import { CopyButton } from "./copy-button"
import { AgentNote } from "./agent-note"
import { UI_MODES, nudgeWorker, type ContentItem, type ContentMode } from "./types"

type Status = "idle" | "queued" | "working" | "done" | "error"

const POLL_INTERVAL_MS = 1500
// A full generate -> score -> regenerate -> score chain has been observed
// taking 3+ minutes live (two real generation passes, two real grading
// passes) — 80 polls (~2 minutes) cut this off before the regenerated
// draft's score ever landed. 280 polls (~7 minutes) gives real headroom.
const MAX_POLLS = 280

export function GeneratePanel({ onGenerated }: { onGenerated?: (item: ContentItem) => void }) {
  const [mode, setMode] = useState<Exclude<ContentMode, "taglines">>("blog_post")
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>("idle")
  const [statusLabel, setStatusLabel] = useState("")
  const [content, setContent] = useState<ContentItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const pollContent = useCallback(
    async (contentId: string) => {
      const res = await fetch(`/api/content/${contentId}`)
      if (!res.ok) return
      const item: ContentItem = await res.json()
      setContent(item)

      if (item.regeneratedTo) {
        // Orchestrator kicked off a rewrite — follow the chain to the newer draft.
        setStatusLabel("Score was low — regenerating a better draft…")
        return pollContent(item.regeneratedTo)
      }

      if (item.scoredAt || !["blog_post", "landing_page", "case_study"].includes(item.mode)) {
        // Scored (or unscorable mode, e.g. social_media/battlecard) — settled.
        stopPolling()
        setStatus("done")
        setStatusLabel("")
        onGenerated?.(item)
      } else {
        setStatusLabel("Grading against the Content Quality Scorecard…")
      }
    },
    [onGenerated, stopPolling]
  )

  const handleSubmit = async () => {
    setError(null)
    setContent(null)
    setStatus("queued")
    setStatusLabel("Queuing…")
    pollCount.current = 0

    const payload = buildPayload(mode, values)
    const res = await fetch("/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to start generation")
      setStatus("error")
      return
    }

    const { taskId } = await res.json()
    setStatus("working")
    setStatusLabel("Writing…")

    let contentId: string | null = null

    intervalRef.current = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > MAX_POLLS) {
        stopPolling()
        setError("Taking longer than expected — check History shortly.")
        setStatus("error")
        return
      }

      nudgeWorker()

      if (!contentId) {
        const taskRes = await fetch(`/api/tasks/${taskId}`)
        if (!taskRes.ok) return
        const task = await taskRes.json()
        if (task.status === "failed") {
          stopPolling()
          setError(task.error ?? "Generation failed")
          setStatus("error")
          return
        }
        if (task.status === "done" && typeof task.result?.contentId === "string") {
          contentId = task.result.contentId
          setStatusLabel("Grading against the Content Quality Scorecard…")
        } else {
          return
        }
      }

      if (contentId) {
        await pollContent(contentId)
      }
    }, POLL_INTERVAL_MS)
  }

  const valid = isFormValid(mode, values)

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={mode}
        onValueChange={(v) => {
          // A previous generation's polling interval must stop before
          // switching modes — otherwise its next tick calls setContent with
          // the old mode's result and it bleeds through into the new tab.
          stopPolling()
          setMode(v as Exclude<ContentMode, "taglines">)
          setValues({})
          setContent(null)
          setStatus("idle")
          setError(null)
        }}
      >
        <TabsList>
          {UI_MODES.map((m) => (
            <TabsTrigger key={m.value} value={m.value}>
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>New {UI_MODES.find((m) => m.value === mode)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ModeFormFields mode={mode} values={values} onChange={handleChange} />
          <Button onClick={handleSubmit} disabled={!valid || status === "queued" || status === "working"}>
            {status === "queued" || status === "working" ? statusLabel || "Working…" : "Generate"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {content && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg font-semibold">{content.topic}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ScorecardView content={content} />
            <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Draft</span>
                <CopyButton text={content.items ? content.items.join("\n\n") : content.body} />
              </div>
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-serif text-base leading-relaxed">
                {content.items ? content.items.join("\n\n") : content.body}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <AgentNote>Writer agent, Evaluator agent, Orchestrator</AgentNote>
    </div>
  )
}
