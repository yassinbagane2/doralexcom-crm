"use client"

import type { DocumentContent } from "@workspace/api/contract"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"
import { useCallback } from "react"

import { NotFound } from "@/components/contracts/template-editor"
import {
  DocumentEditor,
  DocumentEditorLoading,
} from "@/components/editor/document-editor"
import { routes } from "@/config/routes"
import {
  useContractDocument,
  useUpdateContractDocument,
} from "@/hooks/queries/contract"
import { useCustomer } from "@/hooks/queries/customer"

/**
 * A contract generated for one of a customer's leases. Its fields are already
 * filled in: it edits like any document, and stays on the customer's page.
 */
export function ContractDocumentEditor({
  customerId,
  documentId,
}: {
  customerId: string
  documentId: string
}) {
  const t = useTranslations("ContractDocument")
  const contract = useContractDocument(documentId)
  const customer = useCustomer(customerId)
  const update = useUpdateContractDocument()
  const customerHref = `${routes.customers}/${customerId}`

  const onSave = useCallback(
    async (name: string, content: DocumentContent) => {
      await update.mutateAsync({ id: documentId, name, content })
      toast.success(t("saved"))
    },
    [update, documentId, t]
  )

  if (contract.isPending || customer.isPending) return <DocumentEditorLoading />
  if (
    contract.isError ||
    !contract.data ||
    // The address must name the contract's own customer.
    contract.data.customerId !== customerId ||
    !customer.data
  ) {
    return (
      <NotFound
        message={t("notFound")}
        backHref={customerHref}
        backLabel={
          customer.data
            ? t("back", { customer: customer.data.name })
            : undefined
        }
      />
    )
  }

  const lease = customer.data.leases.find(
    (candidate) => candidate.id === contract.data.leaseId
  )

  return (
    <DocumentEditor
      title={contract.data.name}
      content={contract.data.content}
      onSave={onSave}
      backHref={customerHref}
      backLabel={t("back", { customer: customer.data.name })}
      eyebrow={t("eyebrow", { customer: customer.data.name })}
      placeholder={t("placeholder")}
      aside={lease ? t("lease", { property: lease.property.name }) : null}
    />
  )
}
