"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeFormFields, buildPayload, isFormValid } from "./mode-fields"
import { DraftResultCard } from "./draft-result-card"
import { AgentNote } from "./agent-note"
import { UI_MODES, nudgeWorker, type ContentItem, type ContentMode } from "./types"

type Status = "idle" | "queued" | "working" | "error"

const POLL_INTERVAL_MS = 1500
const MAX_TASK_POLLS = 80 // ~2 minutes for the writer itself to produce a draft

export function GeneratePanel({ onGenerated }: { onGenerated?: (item: ContentItem) => void }) {
  const [mode, setMode] = useState<Exclude<ContentMode, "taglines">>("blog_post")
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>("idle")
  const [resultContentId, setResultContentId] = useState<string | null>(null)
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

  const handleSubmit = async () => {
    setError(null)
    setResultContentId(null)
    setStatus("queued")
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

    intervalRef.current = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > MAX_TASK_POLLS) {
        stopPolling()
        setError("Taking longer than expected — check View History shortly.")
        setStatus("error")
        return
      }

      nudgeWorker()

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
        stopPolling()
        setResultContentId(task.result.contentId)
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
          setResultContentId(null)
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
            {status === "queued" ? "Queuing…" : status === "working" ? "Writing…" : "Generate"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {resultContentId && <DraftResultCard contentId={resultContentId} onSettled={onGenerated} />}

      <AgentNote>Writer agent, Evaluator agent, Orchestrator</AgentNote>
    </div>
  )
}
