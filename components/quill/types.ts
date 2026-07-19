// Client-safe mirror of lib/agents/writer.ts's ContentDoc (JSON-serialized —
// Dates arrive as strings). Kept separate from the server type so client
// components never import server-only files (mongodb driver, etc.).

// Nudges the worker to tick sooner than the next cron minute — dev-only.
// In production this was calling /api/worker every ~1.5s during any active
// generation across every panel, each a fresh serverless invocation with
// its own DB connection; combined with an uncapped connection pool (see
// lib/mongodb.ts) this was a real contributor to exhausting the shared
// Atlas cluster's connection limit (confirmed live 2026-07-19). Production
// already has a real cron ticking every minute — no need to nudge it.
export function nudgeWorker() {
  if (process.env.NODE_ENV !== "production") {
    fetch("/api/worker").catch(() => {})
  }
}

export type ContentMode = "blog_post" | "taglines" | "social_media" | "landing_page" | "case_study" | "battlecard"

export type ScorecardBreakdownItem = {
  criterion: string
  met: boolean
  note: string
}

export type ContentItem = {
  contentId: string
  mode: ContentMode
  topic: string
  body: string
  items?: string[]
  brief?: string
  regeneratedFrom?: string
  regeneratedTo?: string | null
  regenerationOutcome?: "improved" | "regressed" | "unchanged"
  previousScore?: number
  meta?: Record<string, string>
  status: "draft" | "published" | "archived"
  origin?: "generated" | "uploaded"
  grade?: "A" | "B" | "C" | "D" | "F"
  score?: number
  breakdown?: ScorecardBreakdownItem[]
  fixGuidance?: string[]
  styleNotes?: string[]
  scoredAt?: string
  createdAt: string
  updatedAt: string
}

export const UI_MODES: { value: ContentMode; label: string }[] = [
  { value: "blog_post", label: "Blog Post" },
  { value: "landing_page", label: "Landing Page" },
  { value: "case_study", label: "Case Study" },
  { value: "social_media", label: "Social Media" },
  { value: "battlecard", label: "Battlecard" },
]

export const MODE_LABEL: Record<ContentMode, string> = {
  blog_post: "Blog Post",
  landing_page: "Landing Page",
  case_study: "Case Study",
  social_media: "Social Media",
  battlecard: "Battlecard",
  taglines: "Taglines",
}
