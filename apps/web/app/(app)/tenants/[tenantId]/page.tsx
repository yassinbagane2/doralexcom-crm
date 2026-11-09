import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { TenantDetail } from "@/components/tenants/tenant-detail"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Tenant")
  return { title: t("metaTitle") }
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  await requireRole("business")
  const { tenantId } = await params

  return (
    <DashboardBody className="pt-6">
      <TenantDetail tenantId={tenantId} />
    </DashboardBody>
  )
}
