import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Navigation")
  const badge = t("adminBadge")
  return { title: { template: `%s · ${badge}`, default: badge } }
}

/** The admin dashboard: a collapsible sidebar beside rounded panels. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // proxy.ts already turns non-admins away; this is the second check.
  const { user } = await requireRole("admin")

  return (
    <DashboardLayout
      role="admin"
      isOwner={false}
      name={user.name}
      email={user.email}
    >
      {children}
    </DashboardLayout>
  )
}
