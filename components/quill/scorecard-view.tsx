import { Badge } from "@/components/ui/badge"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import type { ContentItem } from "./types"

const GRADE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  A: "default",
  B: "default",
  C: "secondary",
  D: "destructive",
  F: "destructive",
}

export function ScorecardView({ content }: { content: ContentItem }) {
  const hasScore = typeof content.score === "number" && content.grade

  return (
    <div className="flex flex-col gap-4">
      {hasScore && (
        <div className="flex items-center gap-3">
          <Badge variant={GRADE_VARIANT[content.grade!] ?? "secondary"} className="h-7 px-3 text-sm">
            {content.grade}
          </Badge>
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{content.score}/100</span>
              {content.regenerationOutcome && (
                <span
                  className={
                    content.regenerationOutcome === "improved"
                      ? "text-emerald-500"
                      : content.regenerationOutcome === "regressed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {content.regenerationOutcome === "improved" && `Improved from ${content.previousScore}`}
                  {content.regenerationOutcome === "regressed" && `Regressed from ${content.previousScore}`}
                  {content.regenerationOutcome === "unchanged" && `Unchanged from ${content.previousScore}`}
                </span>
              )}
            </div>
            <Progress value={content.score ?? null}>
              <ProgressTrack>
                <ProgressIndicator
                  className={
                    (content.score ?? 0) >= 80 ? "bg-emerald-500" : (content.score ?? 0) >= 60 ? "bg-amber-500" : "bg-destructive"
                  }
                />
              </ProgressTrack>
            </Progress>
          </div>
        </div>
      )}

      {content.breakdown && content.breakdown.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Breakdown</span>
          <ul className="flex flex-col gap-1.5">
            {content.breakdown.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={b.met ? "text-emerald-500" : "text-destructive"}>{b.met ? "✓" : "✗"}</span>
                <span>
                  <span className="font-medium">{b.criterion}</span>
                  <span className="text-muted-foreground"> — {b.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.fixGuidance && content.fixGuidance.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fix Guidance</span>
          <ul className="flex flex-col gap-1 text-sm">
            {content.fixGuidance.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}

      {content.styleNotes && content.styleNotes.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Style Notes (informal)</span>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {content.styleNotes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
