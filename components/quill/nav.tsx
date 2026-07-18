"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Content Studio" },
  { href: "/competitive", label: "Competitive Intel" },
  { href: "/serp", label: "SERP Monitor" },
  { href: "/ideas", label: "Ideas" },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-4">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          Quill
        </Link>
        <nav className="flex gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[13px] tracking-[0.02em] transition-colors ${
                pathname === link.href ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"
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
