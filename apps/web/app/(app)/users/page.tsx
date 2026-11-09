import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { BusinessUsers } from "@/components/business/business-users"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BusinessUsers")
  return { title: t("metaTitle") }
}

export default async function UsersPage() {
  await requireRole("business")

  return (
    <DashboardBody className="pt-6">
      <BusinessUsers />
    </DashboardBody>
  )
}
