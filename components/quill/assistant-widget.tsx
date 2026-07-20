"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Sparkles, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

type TaskType = "generate_content" | "monitor_serp" | "fetch_competitor_content" | "suggest_ideas"

type ChatMessage =
  | { id: string; role: "user" | "assistant"; content: string }
  | { id: string; role: "action"; taskId: string; type: TaskType; summary: string; status: "pending" | "done" | "failed"; resultText?: string }

const ACTION_LINK: Record<TaskType, { href: string; label: string }> = {
  generate_content: { href: "/studio", label: "Content Studio" },
  monitor_serp: { href: "/serp", label: "SERP Monitor" },
  fetch_competitor_content: { href: "/competitive", label: "Competitive Market Analysis" },
  suggest_ideas: { href: "/ideas", label: "Ideas" },
}

function formatResult(type: TaskType, result: Record<string, unknown>): string {
  switch (type) {
    case "generate_content": {
      const count = typeof result.wordCount === "number" ? `${result.wordCount} words` : `${result.itemCount ?? ""} items`
      return `Draft written — "${result.topic}" (${count}). It's being graded now.`
    }
    case "monitor_serp": {
      if (result.ownDomain) {
        const rank = result.ownPosition ? `#${result.ownPosition}` : "not in the top results"
        return `You're ${rank} for "${result.keyword}" (${result.ownDomain}).`
      }
      return `Captured ${result.resultCount ?? 0} results for "${result.keyword}".`
    }
    case "fetch_competitor_content": {
      const analyzed = result.analyzed ?? 0
      const failed = typeof result.failed === "number" && result.failed > 0 ? `, ${result.failed} failed` : ""
      return `Analyzed ${analyzed} competitor${analyzed === 1 ? "" : "s"}${failed}.`
    }
    case "suggest_ideas":
      return `${result.ideaCount ?? 0} new idea${result.ideaCount === 1 ? "" : "s"}, based on ${result.basedOnCount ?? 0} tracked keyword${result.basedOnCount === 1 ? "" : "s"}.`
    default:
      return "Done."
  }
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      setMessages((prev) => {
        const pending = prev.filter((m): m is Extract<ChatMessage, { role: "action" }> => m.role === "action" && m.status === "pending")
        if (pending.length === 0) return prev
        pending.forEach(async (action) => {
          const res = await fetch(`/api/tasks/${action.taskId}`)
          if (!res.ok) return
          const task = await res.json()
          if (task.status === "done") {
            setMessages((cur) =>
              cur.map((m) =>
                m.role === "action" && m.taskId === action.taskId
                  ? { ...m, status: "done", resultText: formatResult(m.type, task.result ?? {}) }
                  : m
              )
            )
          } else if (task.status === "failed") {
            setMessages((cur) =>
              cur.map((m) =>
                m.role === "action" && m.taskId === action.taskId
                  ? { ...m, status: "failed", resultText: task.error ?? "This didn't complete." }
                  : m
              )
            )
          }
        })
        return prev
      })
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput("")
    setSending(true)

    const res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history
          .filter((m): m is Extract<ChatMessage, { role: "user" | "assistant" }> => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong — try again." }])
      setSending(false)
      return
    }

    const { reply, actions } = await res.json()
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: reply },
      ...actions.map((a: { type: TaskType; taskId: string; summary: string }) => ({
        id: crypto.randomUUID(),
        role: "action" as const,
        taskId: a.taskId,
        type: a.type,
        summary: a.summary,
        status: "pending" as const,
      })),
    ])
    setSending(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[480px] w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-serif text-base font-semibold">Quill Assistant</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask me to write a blog post, check rankings, analyze competitors, or suggest ideas — I'll actually do it.
              </p>
            )}
            {messages.map((m) => {
              if (m.role === "action") {
                const link = ACTION_LINK[m.type]
                return (
                  <div key={m.id} className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {m.status === "pending" ? "Working…" : m.status === "failed" ? "Failed" : "Done"}
                    </span>
                    <span>{m.status === "pending" ? m.summary : m.resultText}</span>
                    {m.status !== "pending" && (
                      <Link href={link.href} className="text-xs text-primary hover:underline">
                        View in {link.label} →
                      </Link>
                    )}
                  </div>
                )
              }
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"
                  }`}
                >
                  {m.content}
                </div>
              )
            })}
            {sending && <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</div>}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="e.g. check rankings for 'agentic content marketing'"
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
            <Button type="button" size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Open Quill Assistant"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>
    </div>
  )
}
