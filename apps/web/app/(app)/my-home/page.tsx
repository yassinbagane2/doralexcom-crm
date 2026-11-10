import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { MyHome } from "@/components/customers/my-home"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MyHome")
  return { title: t("metaTitle") }
}

export default async function MyHomePage() {
  await requireRole("user")

  return (
    <DashboardBody className="pt-6">
      <MyHome />
    </DashboardBody>
  )
}
