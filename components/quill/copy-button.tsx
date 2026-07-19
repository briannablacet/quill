"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Builds a background-free HTML representation of the draft so pasting into
// a rich text editor (Google Docs, Word, Gmail) produces plain paragraphs —
// copying the rendered <pre> block directly carries the page's own tan
// background color along as inline style, which shows up as a highlight
// behind the pasted text in the destination doc.
function toPlainHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("")
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([toPlainHtml(text)], { type: "text/html" }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      await navigator.clipboard.writeText(text).catch(() => {})
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 px-2 text-xs">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}
