import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { TemplateList } from "@/components/contracts/template-list"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contracts")
  return { title: t("metaTitle") }
}

export default async function ContractsPage() {
  await requireRole("business")

  return (
    <DashboardBody className="pt-6">
      <TemplateList />
    </DashboardBody>
  )
}
