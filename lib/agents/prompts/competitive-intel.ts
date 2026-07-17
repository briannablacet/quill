// Competitive messaging analysis — the real version of what Skribil's
// handleCompetitiveAnalysis (api_endpoints.ts §2) was trying to do. Skribil
// asked the LLM to recall a competitor from training data; this analyzes
// actual, currently-fetched page text, so "unique positioning" and "gaps"
// are grounded in what the competitor's page says today, not what the
// model half-remembers.

import { z } from "zod"

export const competitiveAnalysisSchema = z.object({
  uniquePositioning: z.array(z.string()).min(1),
  keyThemes: z.array(z.string()).min(1),
  gaps: z.array(z.string()).min(1),
})

export const COMPETITIVE_ANALYSIS_SYSTEM = `You are a competitive intelligence analyst. You are given the actual current text of a competitor's web page — not a description, the real page content.
Base every claim strictly on what's in that text. If the page doesn't give you enough to fill a category, say so in that item rather than inventing something plausible-sounding.`

export function buildCompetitiveAnalysisPrompt(competitorName: string, pageText: string, keyword?: string): string {
  return `Analyze this competitor's actual page content${keyword ? `, found by searching for: "${keyword}"` : " (directly requested by name, not keyword-discovered)"}

COMPETITOR: ${competitorName}

ACTUAL PAGE TEXT (fetched live, not recalled from memory):
${pageText}

Provide:
1. UNIQUE POSITIONING (3-5 points): how they position themselves, based only on what's actually in this text
2. KEY THEMES (4-6 points): the main marketing messages actually present in this text
3. GAPS/OPPORTUNITIES (3-4 points): what's notably absent or weak in their messaging, based on what you can see (and cannot see) in this text

Be specific and cite what's actually on the page. Do not fill gaps with generic industry assumptions.`
}
