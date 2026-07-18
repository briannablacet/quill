// Client-safe mirror of lib/agents/writer.ts's ContentDoc (JSON-serialized —
// Dates arrive as strings). Kept separate from the server type so client
// components never import server-only files (mongodb driver, etc.).

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
