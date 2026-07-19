import { redirect } from "next/navigation"
import { getUserId } from "@/lib/session"
import { getCompanyProfile } from "@/lib/agents/company-profile"
import { getBrandProfile } from "@/lib/agents/brand-profile"
import { SettingsPanel } from "@/components/quill/settings-panel"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  const [companyProfile, brandProfile] = await Promise.all([
    getCompanyProfile(userId),
    getBrandProfile(userId),
  ])

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-[15.5px] text-muted-foreground">
        Tell Quill who you are — your company, your voice, and your style — so every generated piece and every competitive check reflects it.
      </p>
      <SettingsPanel
        initialCompanyProfile={JSON.parse(JSON.stringify(companyProfile))}
        initialBrandProfile={JSON.parse(JSON.stringify(brandProfile))}
      />
    </main>
  )
}
