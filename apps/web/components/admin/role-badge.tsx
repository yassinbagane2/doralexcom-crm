"use client"

import type { UserRole } from "@workspace/auth/roles"
import { Badge } from "@workspace/ui/components/ui/badge"
import { useTranslations } from "next-intl"

const VARIANT = {
  admin: "default",
  business: "secondary",
  user: "outline",
} as const

export function RoleBadge({ role }: { role: UserRole }) {
  const t = useTranslations("Roles")
  return <Badge variant={VARIANT[role]}>{t(role)}</Badge>
}
