"use client"

import { useState, useTransition, useRef } from "react"
import { Plus, X, FileText, UploadCloud, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveDirectives, type DirectivesDoc, type ResumeEntry } from "@/lib/actions"
import { parseResumeFile } from "@/lib/parse-resume"

interface ResumesProps {
  initialDirectives: DirectivesDoc | null
}

export function Resumes({ initialDirectives }: ResumesProps) {
  const d = initialDirectives

  const [resumes, setResumes] = useState<ResumeEntry[]>(() => {
    if (d?.resumes?.length) return d.resumes
    if (d?.resumeText) return [{ id: "default", label: "My Resume", text: d.resumeText, fileName: d.resumeFileName ?? "", isDefault: true }]
    return []
  })

  const [isPending, startTransition] = useTransition()
  const [parsing, setParsing] = useState<string | null>(null) // resume id being parsed

  const handleFileUpload = async (id: string, file: File) => {
    setParsing(id)
    try {
      const text = await parseResumeFile(file)
      setResumes((prev) => prev.map((r) => r.id === id ? { ...r, text, fileName: file.name } : r))
      toast.success("Resume extracted", { description: file.name })
    } catch (err) {
      toast.error("Could not read file", { description: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      setParsing(null)
    }
  }

  const save = (updated: ResumeEntry[]) => {
    startTransition(async () => {
      try {
        await saveDirectives({
          ...d,
          resumes: updated,
          resumeText: updated.find((r) => r.isDefault)?.text ?? d?.resumeText ?? "",
          resumeFileName: updated.find((r) => r.isDefault)?.fileName ?? d?.resumeFileName ?? "",
        } as DirectivesDoc)
        toast.success("Resumes saved")
      } catch {
        toast.error("Failed to save resumes")
      }
    })
  }

  const addResume = () => {
    const newEntry: ResumeEntry = {
      id: `resume-${Date.now()}`,
      label: "",
      text: "",
      fileName: "",
      isDefault: resumes.length === 0,
    }
    setResumes((prev) => [...prev, newEntry])
  }

  const updateResume = (id: string, patch: Partial<ResumeEntry>) => {
    setResumes((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))
  }

  const setDefault = (id: string) => {
    setResumes((prev) => prev.map((r) => ({ ...r, isDefault: r.id === id })))
  }

  const removeResume = (id: string) => {
    setResumes((prev) => {
      const wasDefault = prev.find((r) => r.id === id)?.isDefault ?? false
      const filtered = prev.filter((r) => r.id !== id)
      if (wasDefault && filtered.length > 0) filtered[0].isDefault = true
      return filtered
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Your Resumes</CardTitle>
              <CardDescription>
                Name each resume by the role type it targets. The default is used for new matches; you can choose a different one per application on the match detail page.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addResume}>
              <Plus data-icon="inline-start" /> Add resume
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {resumes.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No resumes yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Click &quot;Add resume&quot; to paste in your first one.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addResume}>
                <Plus data-icon="inline-start" /> Add resume
              </Button>
            </div>
          )}

          {resumes.map((resume) => (
            <div key={resume.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <Input
                  value={resume.label}
                  onChange={(e) => updateResume(resume.id, { label: e.target.value })}
                  placeholder="Name this resume, e.g. Senior PM — AI, Head of Product"
                  className="flex-1 font-medium"
                />
                <div className="flex shrink-0 items-center gap-2">
                  {resume.isDefault ? (
                    <Badge variant="secondary" className="bg-success/15 text-success">Default</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => setDefault(resume.id)}
                    >
                      Set as default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove resume"
                    onClick={() => removeResume(resume.id)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              {/* Upload zone */}
              <label
                htmlFor={`resume-upload-${resume.id}`}
                className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-accent/30 px-4 py-4 text-sm transition-colors hover:border-primary/50 hover:bg-accent/50"
              >
                {parsing === resume.id ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Extracting text...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {resume.fileName
                        ? <><span className="font-medium text-foreground">{resume.fileName}</span> — click to replace</>
                        : "Upload PDF, DOCX, or TXT"}
                    </span>
                  </>
                )}
                <input
                  id={`resume-upload-${resume.id}`}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="sr-only"
                  disabled={parsing === resume.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(resume.id, file)
                    e.target.value = ""
                  }}
                />
              </label>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or paste below</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Textarea
                value={resume.text}
                onChange={(e) => updateResume(resume.id, { text: e.target.value })}
                placeholder="Paste your resume text here..."
                className="min-h-56 resize-y font-mono text-xs leading-relaxed"
              />
              <p className="text-xs text-muted-foreground tabular-nums">{resume.text.length.toLocaleString()} characters</p>
            </div>
          ))}

          {resumes.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => save(resumes)} disabled={isPending}>
                {isPending ? "Saving..." : "Save resumes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
