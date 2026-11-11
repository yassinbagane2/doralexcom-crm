import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { PropertyEditor } from "@/components/properties/property-editor"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Properties")
  return { title: t("editor.create.title") }
}

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>
}) {
  await requireRole("business")
  const { from } = await searchParams
  const copyFrom = Array.isArray(from) ? from[0] : from

  return (
    <DashboardBody className="pt-6">
      <PropertyEditor
        // A fresh form when switching between a blank one and a copy.
        key={copyFrom ?? "new"}
        copyFrom={copyFrom || undefined}
      />
    </DashboardBody>
  )
}
