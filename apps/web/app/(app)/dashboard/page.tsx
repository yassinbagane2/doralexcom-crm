import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Navigation")
  return { title: t("dashboard") }
}

export default async function DashboardPage() {
  await requireRole("business")
  const t = await getTranslations("Navigation")

  return (
    <DashboardBody className="pt-6">
      <h1 className="text-xl font-semibold">{t("dashboard")}</h1>
    </DashboardBody>
  )
}
