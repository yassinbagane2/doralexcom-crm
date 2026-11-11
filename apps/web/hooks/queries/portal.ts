"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * A signed-in customer's own records: invoices, receipts, and contracts sent
 * to them for signature. Scoped server-side to their account.
 */

export type PortalInvoice = Awaited<
  ReturnType<typeof orpc.portal.invoices.call>
>[number]
export type PortalDocument = Awaited<
  ReturnType<typeof orpc.portal.documents.call>
>[number]

export function usePortalInvoices() {
  return useQuery(orpc.portal.invoices.queryOptions())
}

export function usePortalReceipt(id: string) {
  return useQuery(orpc.portal.receipt.queryOptions({ input: { id } }))
}

export function usePortalDocuments() {
  return useQuery(orpc.portal.documents.queryOptions())
}

export function usePortalDocument(id: string) {
  return useQuery(orpc.portal.document.queryOptions({ input: { id } }))
}

/**
 * The contract as its stored PDF, signed so far. Signing writes it again
 * before answering, so the refetch after signing shows both signatures.
 */
export function usePortalPdf(id: string) {
  return useQuery({
    ...orpc.portal.pdf.queryOptions({ input: { id } }),
    gcTime: 60_000,
  })
}

export function useSignDocument() {
  const t = useTranslations("Signing")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.portal.sign.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.portal.key() })
        toast.success(t("signedToast"))
      },
    })
  )
}

function useInvalidatePortalInvoices() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.portal.invoices.key() })
}

/** Sends the landlord proof of a payment made outside the app. */
export function useSubmitPaymentProof() {
  const t = useTranslations("MyHome.invoices.proof")
  const invalidate = useInvalidatePortalInvoices()

  return useMutation(
    orpc.portal.submitPaymentProof.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("sent"))
      },
    })
  )
}

export function useCancelPaymentProof() {
  const t = useTranslations("MyHome.invoices.proof")
  const invalidate = useInvalidatePortalInvoices()

  return useMutation(
    orpc.portal.cancelPaymentProof.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("cancelled"))
      },
    })
  )
}

/** Fetches one of the customer's proofs of payment, to show it. */
export function usePortalProofFile() {
  return useMutation(orpc.portal.paymentProofFile.mutationOptions())
}
