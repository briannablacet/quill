import { randomUUID } from "crypto"
import { generateObject } from "ai"
import { getDb } from "@/lib/mongodb"
import type { TaskDoc } from "@/lib/tasks"
import { searchGoogle, fetchPageText } from "./serper"
import { competitiveAnalysisSchema, COMPETITIVE_ANALYSIS_SYSTEM, buildCompetitiveAnalysisPrompt } from "./prompts/competitive-intel"

// ---------------------------------------------------------------------------
// Competitive intel agent — fetch_competitor_content task handler.
// See migration.md §5 Phase 5. Shares its data source (Serper search) with
// the SERP monitor agent (serp-monitor.ts) — same underlying "what's
// actually ranking and what does it say" fetch, two different presentations:
// this one analyzes messaging/positioning, serp-monitor.ts tracks ranking
// changes over time. Neither duplicates the other's fetch logic beyond both
// calling searchGoogle.
// ---------------------------------------------------------------------------

export type CompetitorAnalysis = {
  name: string
  url: string
  uniquePositioning: string[]
  keyThemes: string[]
  gaps: string[]
  error?: string
}

export type CompetitiveIntelDoc = {
  _id?: string
  intelId: string
  userId: string
  // Set for keyword-discovery mode; absent for named-competitor mode.
  keyword?: string
  // Set for named-competitor mode (the raw input list, before resolution).
  requestedCompetitors?: string[]
  competitors: CompetitorAnalysis[]
  sourceTaskId: string
  createdAt: Date
}

type FetchCompetitorContentPayload = {
  // Discovery mode: find competitors by searching this keyword.
  keyword?: string
  numCompetitors?: number
  // Directed mode: analyze exactly these competitors. Each entry can be a
  // URL or a bare company name — bare names are resolved to a URL via one
  // Serper search, same as Skribil's original isURL/extractDomain approach
  // (api_endpoints.ts §2) for handling either input shape.
  competitors?: string[]
}

const URL_LIKE = /^https?:\/\//i
const DOMAIN_LIKE = /\.(com|org|net|io|ai|co|dev)(\/|$)/i

export async function resolveCompetitorTarget(input: string): Promise<{ name: string; url: string }> {
  if (URL_LIKE.test(input) || DOMAIN_LIKE.test(input)) {
    const url = URL_LIKE.test(input) ? input : `https://${input}`
    const name = new URL(url).hostname.replace(/^www\./, "")
    return { name, url }
  }

  // Bare company name — find their actual site via search rather than guessing a URL.
  const results = await searchGoogle(input, { numResults: 3 })
  const top = results.organic[0]
  if (!top) {
    throw new Error(`Could not find a website for competitor: "${input}"`)
  }
  return { name: input, url: top.link }
}

export async function fetchCompetitorContent(task: TaskDoc): Promise<Record<string, unknown>> {
  const { keyword, numCompetitors = 5, competitors: requestedCompetitors } = task.payload as FetchCompetitorContentPayload

  let targets: { name: string; url: string }[]

  if (requestedCompetitors && requestedCompetitors.length > 0) {
    targets = await Promise.all(requestedCompetitors.map(resolveCompetitorTarget))
  } else if (keyword && typeof keyword === "string") {
    const searchResults = await searchGoogle(keyword, { numResults: numCompetitors })
    const topResults = searchResults.organic.slice(0, numCompetitors)
    if (topResults.length === 0) {
      throw new Error(`No search results found for keyword: ${keyword}`)
    }
    targets = topResults.map((r) => ({ name: r.title, url: r.link }))
  } else {
    throw new Error("fetch_competitor_content task requires either 'keyword' (discovery) or 'competitors' (named list) in payload")
  }

  const competitors: CompetitorAnalysis[] = []

  for (const target of targets) {
    try {
      const pageText = await fetchPageText(target.url)
      if (!pageText || pageText.length < 200) {
        throw new Error("Page returned too little readable text (likely JS-rendered or blocked)")
      }

      const { object } = await generateObject({
        model: "anthropic/claude-sonnet-5",
        schema: competitiveAnalysisSchema,
        system: COMPETITIVE_ANALYSIS_SYSTEM,
        prompt: buildCompetitiveAnalysisPrompt(target.name, pageText, keyword),
        temperature: 0.3,
      })

      competitors.push({
        name: target.name,
        url: target.url,
        ...object,
      })
    } catch (err) {
      competitors.push({
        name: target.name,
        url: target.url,
        uniquePositioning: [],
        keyThemes: [],
        gaps: [],
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const db = await getDb()
  const intelId = randomUUID()
  const now = new Date()

  await db.collection<CompetitiveIntelDoc>("competitive_intel").insertOne({
    intelId,
    userId: task.userId,
    ...(keyword ? { keyword } : {}),
    ...(requestedCompetitors ? { requestedCompetitors } : {}),
    competitors,
    sourceTaskId: task.taskId,
    createdAt: now,
  })

  const successCount = competitors.filter((c) => !c.error).length
  return { intelId, analyzed: successCount, failed: competitors.length - successCount }
}
