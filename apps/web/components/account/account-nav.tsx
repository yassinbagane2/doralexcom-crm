"use client"

import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { routes } from "@/config/routes"

const LINKS = [
  { href: routes.account, label: "Profile" },
  { href: routes.accountSecurity, label: "Security" },
] as const

export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Account" className="flex gap-1 border-b">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
