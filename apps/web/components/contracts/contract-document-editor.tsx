"use client"

import type { DocumentContent } from "@workspace/api/contract"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Button } from "@workspace/ui/components/ui/button"
import { ArrowLeftIcon, Loader2, Lock } from "@workspace/ui/icons"
import Link from "next/link"
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
  useWithdrawSignature,
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

  // Sent for signature, the contract is frozen: what the customer signs
  // must be what was sent.
  if (contract.data.signing) {
    return (
      <LockedContract
        id={documentId}
        pending={contract.data.signing.status === "pending"}
        backHref={customerHref}
        backLabel={t("back", { customer: customer.data.name })}
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

function LockedContract({
  id,
  pending,
  backHref,
  backLabel,
}: {
  id: string
  pending: boolean
  backHref: string
  backLabel: string
}) {
  const t = useTranslations("Signing")
  const withdraw = useWithdrawSignature()

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </span>
      <h1 className="font-medium">{t("lockedTitle")}</h1>
      <p className="text-sm text-muted-foreground">
        {pending ? t("lockedPending") : t("lockedCompleted")}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="outline" render={<Link href={backHref} />}>
          <ArrowLeftIcon isHovered className="size-4" />
          {backLabel}
        </Button>
        {pending ? (
          <Button
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate({ id })}
          >
            {withdraw.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("withdraw")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
