import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import type { ContentItem } from "./types"

// A/B read as a pass, C is the neutral middle, D/F read as a fail — matches
// the soft-tint pass/fail treatment from the approved canvas mockup rather
// than a generic red/amber/green traffic light.
const GRADE_TONE: Record<string, "good" | "warn" | "bad"> = {
  A: "good",
  B: "good",
  C: "warn",
  D: "bad",
  F: "bad",
}

const TONE_CLASSES: Record<"good" | "warn" | "bad", { bg: string; text: string }> = {
  good: { bg: "bg-success/15", text: "text-success" },
  warn: { bg: "bg-warning/15", text: "text-warning" },
  bad: { bg: "bg-destructive/15", text: "text-destructive" },
}

// Shared circular grade badge — used here and in the History list, so a
// grade always reads the same way wherever it shows up.
export function GradePill({ grade, size = "md" }: { grade: string; size?: "sm" | "md" }) {
  const tone = GRADE_TONE[grade] ?? "warn"
  const dimensions = size === "sm" ? "size-6 text-xs" : "size-[30px] text-sm"
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dimensions} ${TONE_CLASSES[tone].bg} ${TONE_CLASSES[tone].text}`}
    >
      {grade}
    </span>
  )
}

export function ScorecardView({ content }: { content: ContentItem }) {
  const hasScore = typeof content.score === "number" && content.grade
  const tone = content.grade ? GRADE_TONE[content.grade] ?? "warn" : "warn"

  return (
    <div className="flex flex-col gap-4">
      {hasScore && (
        <div className="flex items-center gap-3">
          <GradePill grade={content.grade!} />
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium tabular-nums">{content.score}/100</span>
              {content.regenerationOutcome && (
                <span
                  className={
                    content.regenerationOutcome === "improved"
                      ? "text-success"
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
                <ProgressIndicator className={TONE_CLASSES[tone].text.replace("text-", "bg-")} />
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
                <span className={b.met ? "text-success" : "text-destructive"}>{b.met ? "✓" : "✗"}</span>
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
