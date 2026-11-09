"use client"

import type { UserRole } from "@workspace/auth/roles"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { matchesRoute, routes } from "@/config/routes"

/** The sections each role works in, beside the app name in the header. */
const LINKS: Record<UserRole, { href: string; label: "users" | "admin" }[]> = {
  admin: [{ href: routes.admin, label: "admin" }],
  business: [{ href: routes.users, label: "users" }],
  user: [],
}

export function AppNav({ role }: { role: UserRole }) {
  const t = useTranslations("AppShell")
  const pathname = usePathname()
  const links = LINKS[role]

  if (links.length === 0) return null

  return (
    <nav aria-label={t("navLabel")} className="ml-4 flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = matchesRoute(pathname, href)

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}
