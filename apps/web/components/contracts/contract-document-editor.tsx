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
import { useTenant } from "@/hooks/queries/tenant"

/**
 * A contract generated for one of a tenant's leases. Its fields are already
 * filled in: it edits like any document, and stays on the tenant's page.
 */
export function ContractDocumentEditor({
  tenantId,
  documentId,
}: {
  tenantId: string
  documentId: string
}) {
  const t = useTranslations("ContractDocument")
  const contract = useContractDocument(documentId)
  const tenant = useTenant(tenantId)
  const update = useUpdateContractDocument()
  const tenantHref = `${routes.tenants}/${tenantId}`

  const onSave = useCallback(
    async (name: string, content: DocumentContent) => {
      await update.mutateAsync({ id: documentId, name, content })
      toast.success(t("saved"))
    },
    [update, documentId, t]
  )

  if (contract.isPending || tenant.isPending) return <DocumentEditorLoading />
  if (
    contract.isError ||
    !contract.data ||
    // The address must name the contract's own tenant.
    contract.data.tenantId !== tenantId ||
    !tenant.data
  ) {
    return (
      <NotFound
        message={t("notFound")}
        backHref={tenantHref}
        backLabel={
          tenant.data ? t("back", { tenant: tenant.data.name }) : undefined
        }
      />
    )
  }

  const lease = tenant.data.leases.find(
    (candidate) => candidate.id === contract.data.leaseId
  )

  return (
    <DocumentEditor
      title={contract.data.name}
      content={contract.data.content}
      onSave={onSave}
      backHref={tenantHref}
      backLabel={t("back", { tenant: tenant.data.name })}
      eyebrow={t("eyebrow", { tenant: tenant.data.name })}
      placeholder={t("placeholder")}
      aside={lease ? t("lease", { property: lease.property.name }) : null}
    />
  )
}
