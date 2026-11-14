import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { PropertyEditor } from "@/components/properties/property-editor"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Properties")
  return { title: t("editor.edit.title") }
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  await requireRole("business")
  const { propertyId } = await params

  return (
    <DashboardBody className="pt-5">
      <PropertyEditor propertyId={propertyId} />
    </DashboardBody>
  )
}
