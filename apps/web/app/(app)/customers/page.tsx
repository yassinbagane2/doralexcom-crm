import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { CustomerList } from "@/components/customers/customer-list"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Customers")
  return { title: t("metaTitle") }
}

export default async function CustomersPage() {
  await requireRole("business")

  return (
    <DashboardBody className="pt-5">
      <CustomerList />
    </DashboardBody>
  )
}
