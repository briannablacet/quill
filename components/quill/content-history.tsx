"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScorecardView, GradePill } from "./scorecard-view"
import { MODE_LABEL, type ContentItem } from "./types"

export function ContentHistory({ items }: { items: ContentItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing generated yet — start on the New tab.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Card key={item.contentId}>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpanded(expanded === item.contentId ? null : item.contentId)}
          >
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="truncate font-serif text-lg font-semibold">{item.topic}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{MODE_LABEL[item.mode]}</Badge>
                {item.grade && <GradePill grade={item.grade} size="sm" />}
              </span>
            </CardTitle>
          </CardHeader>
          {expanded === item.contentId && (
            <CardContent className="flex flex-col gap-4">
              <ScorecardView content={item} />
              <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Draft</span>
                <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-serif text-base leading-relaxed">
                  {item.items ? item.items.join("\n\n") : item.body}
                </pre>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
