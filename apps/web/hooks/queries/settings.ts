"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { authClient, unwrap } from "@/lib/auth-client"
import { orpc } from "@/lib/orpc"

/*
 * Settings: collaborators (listed for everyone in the business, managed by
 * its owner), and the owner's email service and web address.
 */

// --- Collaborators -----------------------------------------------------------

export function useCollaborators() {
  return useQuery(orpc.collaborator.list.queryOptions())
}

const invitationsKey = (organizationId: string) =>
  ["organization", organizationId, "invitations"] as const

/**
 * Invitations the owner sent, newest first, one per email: re-inviting
 * someone replaces their earlier invitation, so only the latest counts.
 * Better Auth only lists them for the owner.
 */
export function useInvitations(organizationId: string, enabled: boolean) {
  return useQuery({
    queryKey: invitationsKey(organizationId),
    enabled,
    queryFn: async () => {
      const invitations = await unwrap(
        authClient.organization.listInvitations({ query: { organizationId } })
      )
      const latest = new Map<string, (typeof invitations)[number]>()
      for (const invitation of [...invitations].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )) {
        const email = invitation.email.toLowerCase()
        if (!latest.has(email)) latest.set(email, invitation)
      }
      return [...latest.values()]
    },
  })
}

export type Invitation = NonNullable<
  ReturnType<typeof useInvitations>["data"]
>[number]

function useInvalidateInvitations(organizationId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: invitationsKey(organizationId) })
}

export function useInviteCollaborator(organizationId: string) {
  const t = useTranslations("Collaborators")
  const invalidate = useInvalidateInvitations(organizationId)

  return useMutation(
    orpc.collaborator.invite.mutationOptions({
      onSuccess: async ({ emailSent }, input) => {
        await invalidate()
        if (emailSent) {
          toast.success(t("invited", { email: input.email }))
        } else {
          toast.error(t("invitedNoEmail", { email: input.email }))
        }
      },
    })
  )
}

export function useResendInvitation(organizationId: string) {
  const t = useTranslations("Collaborators")
  const invalidate = useInvalidateInvitations(organizationId)

  return useMutation(
    orpc.collaborator.resendInvitation.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("resent"))
      },
    })
  )
}

export function useCancelInvitation(organizationId: string) {
  const t = useTranslations("Collaborators")
  const invalidate = useInvalidateInvitations(organizationId)

  return useMutation({
    mutationFn: (invitationId: string) =>
      unwrap(authClient.organization.cancelInvitation({ invitationId })),
    onSuccess: async () => {
      await invalidate()
      toast.success(t("canceled"))
    },
  })
}

/** Better Auth removes the membership; its hook then deletes the account. */
export function useRemoveCollaborator(organizationId: string) {
  const t = useTranslations("Collaborators")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      unwrap(
        authClient.organization.removeMember({
          memberIdOrEmail: memberId,
          organizationId,
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.collaborator.list.key(),
      })
      toast.success(t("removed"))
    },
  })
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
