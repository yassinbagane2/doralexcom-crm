import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DashboardBody } from "@/components/admin/dashboard"
import { SignDocument } from "@/components/signature/sign-document"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Signing")
  return { title: t("metaTitle") }
}

/** A contract the landlord sent the signed-in customer: to read and sign. */
export default async function MyDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const session = await requireRole("user")
  const { documentId } = await params

  return (
    <DashboardBody className="pt-5">
      <SignDocument id={documentId} signerName={session.user.name} />
    </DashboardBody>
  )
}
