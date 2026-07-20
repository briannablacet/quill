import { redirect } from "next/navigation"
import Link from "next/link"
import { PenLine, Users, TrendingUp, Lightbulb, type LucideIcon } from "lucide-react"
import { getUserId } from "@/lib/session"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export const dynamic = "force-dynamic"

const MODULES: { href: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    href: "/studio",
    icon: PenLine,
    title: "Content Studio",
    description:
      "Write new content, or paste in something written elsewhere, and grade it against a real Content Quality Scorecard — with a Fix This action to resolve what it flags.",
  },
  {
    href: "/competitive",
    icon: Users,
    title: "Competitive Market Analysis",
    description: "See how your own site stacks up against whoever's actually ranking for a keyword you care about.",
  },
  {
    href: "/serp",
    icon: TrendingUp,
    title: "SERP Monitor",
    description: "Check who ranks for a keyword right now, and track how that changes over time.",
  },
  {
    href: "/ideas",
    icon: Lightbulb,
    title: "Ideas",
    description: "Get content ideas targeted at the keywords you're actually tracking in SERP Monitor.",
  },
]

export default async function HomePage() {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Quill</h1>
        <p className="text-[15.5px] text-muted-foreground">
          Quill is an agentic content marketing system: it writes a draft, grades it against a real Content Quality
          Scorecard, and automatically rewrites anything that scores too low — no human review step required before
          that correction happens. A task queue, a writer agent, and an evaluator agent that catches and fixes its
          own mistakes. Pick a module below to get started, or use the assistant in the corner to just ask for what
          you want done.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODULES.map((m) => {
          const Icon = m.icon
          return (
            <Link key={m.href} href={m.href} className="block transition-transform hover:-translate-y-0.5">
              <Card className="h-full border-l-4 border-l-primary transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif text-lg">
                    <Icon className="size-4 text-primary" />
                    {m.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <span className="text-sm font-medium text-primary">Go to {m.title} →</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Set up your company, brand voice, and style guide in <Link href="/settings" className="text-primary hover:underline">Settings</Link> so
        every module above reflects it.
      </p>
    </main>
  )
}
