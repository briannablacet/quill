// Serper.dev client — real Google search results, not the model's training
// data. This is the piece Skribil's "competitive analysis" never had: its
// handleCompetitiveAnalysis (api_endpoints.ts) just asked the LLM what it
// remembered about a competitor, with no live fetch at all. Everything in
// this file returns data that was actually true at call time.

export type OrganicResult = {
  position: number
  title: string
  link: string
  snippet: string
  date?: string
}

export type SerperSearchResponse = {
  organic: OrganicResult[]
  searchParameters: {
    q: string
    gl?: string
    hl?: string
  }
}

export type SerperSearchOptions = {
  country?: string // gl, e.g. "us"
  language?: string // hl, e.g. "en"
  numResults?: number // 10-100, Serper default is 10
}

export async function searchGoogle(query: string, options: SerperSearchOptions = {}): Promise<SerperSearchResponse> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    throw new Error("SERPER_API_KEY environment variable is not set")
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: options.country ?? "us",
      hl: options.language ?? "en",
      num: options.numResults ?? 10,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Serper search failed (${response.status}): ${body.slice(0, 300)}`)
  }

  return response.json()
}

// Fetches a page's actual text content, stripped of markup — used by
// competitive messaging analysis to read real current copy rather than
// relying on a short search snippet. Deliberately simple: no JS rendering,
// no paywall handling. Sites that block plain fetches or render client-side
// will yield thin/empty text, which the caller should treat as "couldn't
// read this one" rather than something to paper over.
export async function fetchPageText(url: string, maxChars = 6000): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuillBot/1.0)" },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url} (${response.status})`)
  }

  const html = await response.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

  return text.slice(0, maxChars)
}
