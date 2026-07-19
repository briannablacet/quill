"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScorecardView } from "./scorecard-view"
import { parseDocumentFile } from "@/lib/parse-document"
import { nudgeWorker } from "./types"
import type { ContentItem, ContentMode } from "./types"

const REVIEWABLE_MODES: { value: Extract<ContentMode, "blog_post" | "landing_page" | "case_study">; label: string }[] = [
  { value: "blog_post", label: "Blog Post" },
  { value: "landing_page", label: "Landing Page" },
  { value: "case_study", label: "Case Study" },
]

type Status = "idle" | "queued" | "working" | "done" | "error"

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 80

export function UploadPanel({ onReviewed }: { onReviewed?: (item: ContentItem) => void }) {
  const [mode, setMode] = useState<"blog_post" | "landing_page" | "case_study">("blog_post")
  const [topic, setTopic] = useState("")
  const [body, setBody] = useState("")
  const [callToAction, setCallToAction] = useState("")
  const [sourceFacts, setSourceFacts] = useState("")
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

  const handleFile = async (file: File | null) => {
    if (!file) return
    try {
      const text = await parseDocumentFile(file)
      setBody(text)
      if (!topic) setTopic(file.name.replace(/\.[^.]+$/, ""))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file")
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setContent(null)
    setStatus("queued")
    setStatusLabel("Queuing…")
    pollCount.current = 0

    const res = await fetch("/api/content/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        topic: topic.trim(),
        body: body.trim(),
        ...(mode === "landing_page" ? { callToAction: callToAction.trim() } : {}),
        ...(mode === "case_study" && sourceFacts.trim() ? { sourceFacts: sourceFacts.trim() } : {}),
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      setError(errBody.error ?? "Failed to start review")
      setStatus("error")
      return
    }

    const { taskId, contentId } = await res.json()
    setStatus("working")
    setStatusLabel("Grading against the Content Quality Scorecard…")

    intervalRef.current = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > MAX_POLLS) {
        stopPolling()
        setError("Taking longer than expected — check History shortly.")
        setStatus("error")
        return
      }

      nudgeWorker()

      const res = await fetch(`/api/content/${contentId}`)
      if (!res.ok) return
      const item: ContentItem = await res.json()
      if (item.scoredAt) {
        stopPolling()
        setContent(item)
        setStatus("done")
        setStatusLabel("")
        onReviewed?.(item)
      }
    }, POLL_INTERVAL_MS)
  }

  const valid =
    topic.trim().length > 0 &&
    body.trim().length > 0 &&
    (mode !== "landing_page" || callToAction.trim().length > 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Review Existing Content</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Paste or upload something Quill didn't write — a draft, a published piece, anything — and grade it
            against the same Content Quality Scorecard used for generated drafts.
          </p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList>
              {REVIEWABLE_MODES.map((m) => (
                <TabsTrigger key={m.value} value={m.value}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-topic">{mode === "case_study" ? "Customer / title" : "Title"}</Label>
            <Input id="upload-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Why third-party data platforms are the wrong SIEM foundation" />
          </div>

          {mode === "landing_page" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-cta">Call to action</Label>
              <Input id="upload-cta" value={callToAction} onChange={(e) => setCallToAction(e.target.value)} placeholder="e.g. Request a demo" />
            </div>
          )}

          {mode === "case_study" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-facts">Key facts to check accuracy against (optional)</Label>
              <Textarea
                id="upload-facts"
                value={sourceFacts}
                onChange={(e) => setSourceFacts(e.target.value)}
                placeholder={"Customer: Acme Corp\nProblem: ...\nResults: ..."}
                rows={3}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-file">Upload a file (DOCX, TXT, MD) or paste below</Label>
            <input
              id="upload-file"
              type="file"
              accept=".docx,.doc,.txt,.md"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-body">Content</Label>
            <Textarea
              id="upload-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the full text here"
              rows={10}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!valid || status === "queued" || status === "working"} className="self-start">
            {status === "queued" || status === "working" ? statusLabel || "Working…" : "Score This"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {content && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg font-semibold">{content.topic}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScorecardView content={content} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
