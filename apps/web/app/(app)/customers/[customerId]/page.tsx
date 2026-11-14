import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { CustomerDetail } from "@/components/customers/customer-detail"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Customer")
  return { title: t("metaTitle") }
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  await requireRole("business")
  const { customerId } = await params

  return (
    <DashboardBody className="pt-5">
      <CustomerDetail customerId={customerId} />
    </DashboardBody>
  )
}
