import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { ContentMode } from "./types"

export type FieldConfig = {
  name: string
  label: string
  type: "text" | "textarea" | "list" | "platform"
  required?: boolean
  placeholder?: string
}

export const MODE_FIELDS: Record<Exclude<ContentMode, "taglines">, FieldConfig[]> = {
  blog_post: [
    { name: "topic", label: "Topic", type: "text", required: true, placeholder: "e.g. Why third-party big data platforms are the wrong foundation for a SIEM" },
    { name: "brief", label: "Brief", type: "textarea", placeholder: "Audience, angle, anything to mention" },
  ],
  landing_page: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "callToAction", label: "Call to Action", type: "text", required: true, placeholder: "e.g. Request a demo" },
    { name: "goal", label: "Goal", type: "text", placeholder: "What should this page accomplish?" },
    { name: "bullets", label: "Bullets", type: "list", placeholder: "One per line" },
    { name: "additionalDetails", label: "Additional Details", type: "textarea" },
  ],
  case_study: [
    { name: "customerName", label: "Customer Name", type: "text", required: true },
    { name: "customerRole", label: "Customer Role", type: "text" },
    { name: "company", label: "Company", type: "text" },
    { name: "problem", label: "Problem", type: "textarea", required: true },
    { name: "solution", label: "Solution", type: "textarea", required: true },
    { name: "results", label: "Results", type: "textarea", required: true },
    { name: "quote", label: "Quote", type: "textarea" },
    { name: "quoteSpeaker", label: "Quote Speaker", type: "text" },
  ],
  social_media: [
    { name: "content", label: "Source Content", type: "textarea", required: true, placeholder: "The idea or content to turn into posts" },
    { name: "platform", label: "Platform", type: "platform" },
    { name: "tone", label: "Tone", type: "text", placeholder: "e.g. professional, conversational" },
  ],
  battlecard: [
    { name: "competitor", label: "Competitor", type: "text", required: true, placeholder: "Name or URL" },
    { name: "positioning", label: "Our Positioning", type: "textarea", required: true },
    { name: "ourAdvantages", label: "Our Advantages", type: "textarea" },
  ],
}

const PLATFORMS = ["linkedin", "twitter", "facebook", "instagram"]

export function ModeFormFields({
  mode,
  values,
  onChange,
}: {
  mode: Exclude<ContentMode, "taglines">
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {MODE_FIELDS[mode].map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          {field.type === "text" && (
            <Input
              id={field.name}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
          )}
          {(field.type === "textarea" || field.type === "list") && (
            <Textarea
              id={field.name}
              value={values[field.name] ?? ""}
              placeholder={field.type === "list" ? field.placeholder : field.placeholder}
              onChange={(e) => onChange(field.name, e.target.value)}
              rows={field.type === "list" ? 3 : 4}
            />
          )}
          {field.type === "platform" && (
            <select
              id={field.name}
              value={values[field.name] ?? "linkedin"}
              onChange={(e) => onChange(field.name, e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  )
}

export function buildPayload(mode: Exclude<ContentMode, "taglines">, values: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = { mode }
  for (const field of MODE_FIELDS[mode]) {
    const raw = values[field.name]
    if (!raw) continue
    if (field.type === "list") {
      payload[field.name] = raw.split("\n").map((s) => s.trim()).filter(Boolean)
    } else {
      payload[field.name] = raw
    }
  }
  return payload
}

export function isFormValid(mode: Exclude<ContentMode, "taglines">, values: Record<string, string>): boolean {
  return MODE_FIELDS[mode].every((field) => !field.required || (values[field.name] ?? "").trim().length > 0)
}
