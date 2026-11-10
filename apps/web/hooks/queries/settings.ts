"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * Settings: collaborators (listed for everyone in the business, managed by
 * its owner), and the owner's email service and web address.
 */

// --- Collaborators -----------------------------------------------------------

export function useCollaborators() {
  return useQuery(orpc.collaborator.list.queryOptions())
}

function useInvalidateCollaborators() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.collaborator.list.key() })
}

export function useInviteCollaborator() {
  const t = useTranslations("Collaborators")
  const invalidate = useInvalidateCollaborators()

  return useMutation(
    orpc.collaborator.invite.mutationOptions({
      onSuccess: async ({ emailSent }, input) => {
        await invalidate()
        if (emailSent) {
          toast.success(t("invited", { email: input.email }))
        } else {
          toast.error(t("invitedNoEmail", { name: input.name }))
        }
      },
    })
  )
}

export function useResendInvitation() {
  const t = useTranslations("Collaborators")

  return useMutation(
    orpc.collaborator.resendInvitation.mutationOptions({
      onSuccess: () => toast.success(t("resent")),
    })
  )
}

export function useRemoveCollaborator() {
  const t = useTranslations("Collaborators")
  const invalidate = useInvalidateCollaborators()

  return useMutation(
    orpc.collaborator.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("removed"))
      },
    })
  )
}

// --- Email service -----------------------------------------------------------

export function useEmailSettings() {
  return useQuery(orpc.settings.getEmail.queryOptions())
}

export function useSaveEmailSettings() {
  const t = useTranslations("EmailSettings")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.settings.saveEmail.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.settings.getEmail.key(),
        })
        toast.success(t("saved"))
      },
    })
  )
}

export function useRemoveEmailSettings() {
  const t = useTranslations("EmailSettings")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.settings.removeEmail.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.settings.getEmail.key(),
        })
        toast.success(t("removed"))
      },
    })
  )
}

/** Errors are shown by the form: a failed send carries the provider's reason. */
export function useSendTestEmail() {
  const t = useTranslations("EmailSettings")

  return useMutation(
    orpc.settings.testEmail.mutationOptions({
      meta: { silent: true },
      onSuccess: ({ to }) => toast.success(t("testSent", { email: to })),
    })
  )
}

// --- Web address -------------------------------------------------------------

export function useDomainSettings() {
  return useQuery(orpc.settings.getDomain.queryOptions())
}

function useWriteDomain() {
  const queryClient = useQueryClient()
  return (data: Awaited<ReturnType<typeof orpc.settings.getDomain.call>>) =>
    queryClient.setQueryData(orpc.settings.getDomain.queryKey(), data)
}

export function useSetDomain() {
  const write = useWriteDomain()
  return useMutation(
    orpc.settings.setDomain.mutationOptions({ onSuccess: write })
  )
}

export function useVerifyDomain() {
  const t = useTranslations("DomainSettings")
  const write = useWriteDomain()

  return useMutation(
    orpc.settings.verifyDomain.mutationOptions({
      onSuccess: (data) => {
        write(data)
        if (data.domain?.status === "active") {
          toast.success(t("verified", { hostname: data.domain.hostname }))
        }
      },
    })
  )
}

export function useRemoveDomain() {
  const t = useTranslations("DomainSettings")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.settings.removeDomain.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.settings.getDomain.key(),
        })
        toast.success(t("removed"))
      },
    })
  )
}

// --- Receipts ----------------------------------------------------------------

export function usePaymentReceipt(paymentId: string) {
  return useQuery(orpc.lease.receipt.queryOptions({ input: { id: paymentId } }))
}
