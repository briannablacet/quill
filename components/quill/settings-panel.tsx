"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseDocumentFile } from "@/lib/parse-document"
import { AgentNote } from "./agent-note"
import type { BrandProfileDoc, StyleGuidePreset } from "@/lib/agents/brand-profile"
import type { CompanyProfileDoc } from "@/lib/agents/company-profile"

const STYLE_GUIDE_OPTIONS: { value: StyleGuidePreset; label: string }[] = [
  { value: "chicago", label: "Chicago Manual of Style" },
  { value: "ap", label: "AP Style" },
  { value: "apa", label: "APA Style" },
]

export function SettingsPanel({
  initialCompanyProfile,
  initialBrandProfile,
}: {
  initialCompanyProfile: CompanyProfileDoc | null
  initialBrandProfile: BrandProfileDoc | null
}) {
  const router = useRouter()

  const [companyName, setCompanyName] = useState(initialCompanyProfile?.companyName ?? "")
  const [websiteUrl, setWebsiteUrl] = useState(initialCompanyProfile?.websiteUrl ?? "")
  const [savingCompany, setSavingCompany] = useState(false)
  const [companySaved, setCompanySaved] = useState(false)

  const [styleGuidePreset, setStyleGuidePreset] = useState<StyleGuidePreset>(
    initialBrandProfile?.styleGuidePreset ?? "chicago"
  )
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brandProfile, setBrandProfile] = useState(initialBrandProfile)

  const saveCompany = async () => {
    if (!companyName.trim() || !websiteUrl.trim()) return
    setSavingCompany(true)
    setCompanySaved(false)
    try {
      const res = await fetch("/api/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim(), websiteUrl: websiteUrl.trim() }),
      })
      if (res.ok) {
        setCompanySaved(true)
        router.refresh()
      }
    } finally {
      setSavingCompany(false)
    }
  }

  const uploadMessaging = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const text = await parseDocumentFile(file)
      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messagingText: text, styleGuidePreset, sourceDocuments: [file.name] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Failed to save messaging framework")
        return
      }
      const { profile } = await res.json()
      setBrandProfile(profile)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Company</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The baseline for competitive analysis and SERP rankings — so Quill can compare competitors against you, not just against each other.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Skribil"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website-url">Website URL</Label>
            <Input
              id="website-url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="e.g. https://www.skribil.com"
            />
          </div>
          <Button
            onClick={saveCompany}
            disabled={!companyName.trim() || !websiteUrl.trim() || savingCompany}
            className="self-start"
          >
            {savingCompany ? "Saving…" : companySaved ? "Saved" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Voice & Messaging</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {brandProfile && (
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
              <span className="font-serif text-base font-semibold">{brandProfile.brandName}</span>
              {brandProfile.tagline && <span className="text-muted-foreground">{brandProfile.tagline}</span>}
              {brandProfile.messaging.keyMessages.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                  {brandProfile.messaging.keyMessages.slice(0, 3).map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="style-guide">Style guide</Label>
            <Select
              value={styleGuidePreset}
              onValueChange={(v) => {
                if (v) setStyleGuidePreset(v as StyleGuidePreset)
              }}
            >
              <SelectTrigger id="style-guide">
                <SelectValue>
                  {(value: StyleGuidePreset) => STYLE_GUIDE_OPTIONS.find((o) => o.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STYLE_GUIDE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="messaging-file">Messaging framework document</Label>
            <input
              id="messaging-file"
              type="file"
              accept=".docx,.doc,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
          </div>

          <Button onClick={uploadMessaging} disabled={!file || uploading} className="self-start">
            {uploading ? "Reading & saving…" : "Add messaging framework"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <AgentNote>Brand Profile extraction agent</AgentNote>
    </div>
  )
}
