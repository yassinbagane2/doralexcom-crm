"use client"

import type { UserRole } from "@workspace/auth/roles"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { routes } from "@/config/routes"

const LINKS = [
  { href: routes.account, label: "profile" },
  { href: routes.accountSecurity, label: "security" },
  { href: routes.accountOrganization, label: "organization" },
  { href: routes.accountPreferences, label: "preferences" },
] as const

export function AccountNav({ role }: { role: UserRole }) {
  const t = useTranslations("AccountNav")
  const pathname = usePathname()
  // Only a business owns (and so can edit) an organization.
  const links = LINKS.filter(
    ({ href }) => href !== routes.accountOrganization || role === "business"
  )

  return (
    <nav
      aria-label={t("label")}
      className="flex gap-1 overflow-x-auto border-b"
    >
      {links.map(({ href, label }) => {
        const active = pathname === href

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}
