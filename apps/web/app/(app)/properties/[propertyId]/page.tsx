import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { PropertyDetail } from "@/components/properties/property-detail"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Properties")
  return { title: t("detail.metaTitle") }
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  await requireRole("business")
  const { propertyId } = await params

  return (
    <DashboardBody className="pt-6">
      <PropertyDetail propertyId={propertyId} />
    </DashboardBody>
  )
}
