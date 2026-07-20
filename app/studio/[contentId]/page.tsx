import { redirect } from "next/navigation"
import Link from "next/link"
import { getUserId } from "@/lib/session"
import { DraftResultCard } from "@/components/quill/draft-result-card"

export const dynamic = "force-dynamic"

export default async function StudioContentPage({ params }: { params: Promise<{ contentId: string }> }) {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  const { contentId } = await params

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-10">
      <Link href="/studio" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Content Studio
      </Link>
      <DraftResultCard contentId={contentId} />
    </main>
  )
}
