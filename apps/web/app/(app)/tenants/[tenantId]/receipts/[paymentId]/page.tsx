import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { PaymentReceipt } from "@/components/tenants/payment-receipt"
import { getMemberRole, requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Receipt")
  return { title: t("title") }
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ tenantId: string; paymentId: string }>
}) {
  await requireRole("business")
  const { tenantId, paymentId } = await params
  const isOwner = (await getMemberRole()) === "owner"

  return (
    <DashboardBody className="pt-6">
      <PaymentReceipt
        tenantId={tenantId}
        paymentId={paymentId}
        isOwner={isOwner}
      />
    </DashboardBody>
  )
}
