import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { CustomerReceipt } from "@/components/customers/payment-receipt"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Receipt")
  return { title: t("title") }
}

/** A receipt for one of the signed-in customer's own payments. */
export default async function MyReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>
}) {
  await requireRole("user")
  const { paymentId } = await params

  return (
    <DashboardBody className="pt-5">
      <CustomerReceipt paymentId={paymentId} />
    </DashboardBody>
  )
}
