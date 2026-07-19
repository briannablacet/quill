"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Content Studio" },
  { href: "/competitive", label: "Competitive Market Analysis" },
  { href: "/serp", label: "SERP Monitor" },
  { href: "/ideas", label: "Ideas" },
  { href: "/settings", label: "Settings" },
]

export function Nav({ companyName }: { companyName?: string }) {
  const pathname = usePathname()

  return (
    <div className="border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight">Quill</span>
          {companyName && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
              for {companyName}
            </span>
          )}
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap text-sm font-semibold tracking-[0.01em] transition-colors ${
                pathname === link.href ? "text-primary" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
