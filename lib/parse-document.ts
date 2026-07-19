/**
 * Client-side plain-text extraction for uploaded documents (messaging
 * frameworks, style docs). Call from a browser context only — mammoth
 * needs a real DOM/ArrayBuffer, not a Server Component or API route.
 */

export async function parseDocumentFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase()

  if (ext === "doc" || ext === "docx") {
    const mammoth = await import("mammoth")
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  if (ext === "txt" || ext === "md") {
    return file.text()
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload a DOCX, DOC, TXT, or MD file.`)
}
