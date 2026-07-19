// Revision prompt for the "Fix This" action on reviewed (uploaded) content.
// Deliberately mode-agnostic and format-preserving: unlike the from-scratch
// writer prompts (blog-post.ts etc.), this edits an existing, already-
// structured piece to resolve specific flagged issues without changing its
// underlying shape, facts, or anything that already scored well.

export const REVISE_CONTENT_SYSTEM = `You are a precise editor fixing a specific, named list of problems in an existing piece of content.
Preserve the piece's existing structure, facts, and everything that already works. Change only what's needed to resolve the listed issues — do not rewrite from scratch, do not invent new facts or claims, and do not introduce a different tone or structure than the original.
Return only the revised piece itself — no preamble, no explanation, no markdown formatting.`

export function buildRevisePrompt(
  topic: string,
  body: string,
  fixGuidance: string[],
  brandRules?: string[]
): string {
  const brandSection = brandRules?.length
    ? `\nIt must also still follow these real brand style rules:\n${brandRules.map((r) => `- ${r}`).join("\n")}\n`
    : ""

  return `Here is an existing piece of content, written on the topic: "${topic}"

ORIGINAL:
${body}

An editorial review flagged these specific issues to fix:
${fixGuidance.map((f) => `- ${f}`).join("\n")}
${brandSection}
Rewrite the piece, resolving every listed issue while preserving everything else — the structure, the real facts, and any parts that weren't flagged. Do not add a new issue while fixing another (e.g. don't fix a banned word by introducing a cliché).

Return only the full revised piece of content.`
}
