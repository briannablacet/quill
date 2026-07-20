"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScorecardView } from "./scorecard-view"
import { CopyButton } from "./copy-button"
import { nudgeWorker } from "./types"
import type { ContentItem } from "./types"

const POLL_INTERVAL_MS = 1500
// A full generate -> score -> regenerate -> score chain has been observed
// taking 3+ minutes live (two real generation passes, two real grading
// passes) — 280 polls (~7 minutes) gives real headroom.
const MAX_POLLS = 280

// The single shared "here's the draft, here's its Scorecard" view — used by
// the Write tab right after generating, and by anything that links to a
// specific piece of content by ID (the assistant, most notably) so a
// generated draft always looks and behaves identically no matter how it was
// created, rather than the assistant's link landing on a blank form.
export function DraftResultCard({ contentId, onSettled }: { contentId: string; onSettled?: (item: ContentItem) => void }) {
  const [content, setContent] = useState<ContentItem | null>(null)
  const [settled, setSettled] = useState(false)
  const [statusLabel, setStatusLabel] = useState("Grading against the Content Quality Scorecard…")
  const [error, setError] = useState<string | null>(null)
  const pollCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const pollContent = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/content/${id}`)
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
        setSettled(true)
        setStatusLabel("")
        onSettled?.(item)
      } else {
        setStatusLabel("Grading against the Content Quality Scorecard…")
      }
    },
    [onSettled, stopPolling]
  )

  useEffect(() => {
    pollCount.current = 0
    pollContent(contentId)
    intervalRef.current = setInterval(async () => {
      pollCount.current += 1
      if (pollCount.current > MAX_POLLS) {
        stopPolling()
        setError("Taking longer than expected — check View History shortly.")
        return
      }
      nudgeWorker()
      await pollContent(contentId)
    }, POLL_INTERVAL_MS)
    return stopPolling
    // Re-run only if we're asked to show a different piece of content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId])

  if (error) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!settled || !content) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{statusLabel || "Working…"}</p>
        </CardContent>
      </Card>
    )
  }

  return (
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
  )
}
