import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { BusinessDashboard } from "@/components/dashboard/business-dashboard"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard")
  return { title: t("metaTitle") }
}

export default async function DashboardPage() {
  await requireRole("business")

  return (
    <DashboardBody className="pt-6">
      <BusinessDashboard />
    </DashboardBody>
  )
}
