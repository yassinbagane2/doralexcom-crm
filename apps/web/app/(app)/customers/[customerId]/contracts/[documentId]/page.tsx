import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ContractDocumentEditor } from "@/components/contracts/contract-document-editor"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContractDocument")
  return { title: t("metaTitle") }
}

export default async function CustomerContractPage({
  params,
}: {
  params: Promise<{ customerId: string; documentId: string }>
}) {
  await requireRole("business")
  const { customerId, documentId } = await params

  return (
    <div className="flex min-h-0 flex-1">
      <ContractDocumentEditor
        key={documentId}
        customerId={customerId}
        documentId={documentId}
      />
    </div>
  )
}
