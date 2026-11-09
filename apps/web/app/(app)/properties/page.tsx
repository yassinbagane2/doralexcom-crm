import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { BusinessProperties } from "@/components/properties/business-properties"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Properties")
  return { title: t("metaTitle") }
}

export default async function PropertiesPage() {
  await requireRole("business")

  return (
    <DashboardBody className="pt-6">
      <BusinessProperties />
    </DashboardBody>
  )
}
