"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * Tenants, their leases and the rent paid on them, through the API's tenant
 * and lease routers. Every business call is scoped server-side to the
 * organization the business owns.
 */

export type TenantSummary = Awaited<
  ReturnType<typeof orpc.tenant.list.call>
>[number]
export type TenantDetail = Awaited<ReturnType<typeof orpc.tenant.get.call>>
export type TenantLease = TenantDetail["leases"][number]
export type TenantInput = Parameters<typeof orpc.tenant.create.call>[0]
export type LeaseTerms = Omit<
  Parameters<typeof orpc.lease.create.call>[0],
  "tenantId" | "propertyId"
>
export type LeaseBalance = Awaited<ReturnType<typeof orpc.lease.terminate.call>>

export function useTenants() {
  return useQuery(orpc.tenant.list.queryOptions())
}

export function useTenant(id: string) {
  return useQuery(orpc.tenant.get.queryOptions({ input: { id } }))
}

export function useMyTenancy() {
  return useQuery(orpc.tenant.mine.queryOptions())
}

/**
 * Anything about a tenant can change what the tenant list, the tenant's page
 * and the property list show (occupants come from leases), so refresh all.
 */
function useInvalidateTenancy() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.tenant.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.property.list.key() }),
      // Tenants are the business's users: the users page lists them too.
      queryClient.invalidateQueries({
        queryKey: orpc.business.listUsers.key(),
      }),
    ])
}

export function useCreateTenant() {
  const t = useTranslations("Tenants")
  const invalidate = useInvalidateTenancy()

  return useMutation(
    orpc.tenant.create.mutationOptions({
      onSuccess: async (_, input) => {
        await invalidate()
        toast.success(t("created", { name: input.name }))
      },
    })
  )
}

export function useUpdateTenant() {
  const t = useTranslations("Tenants")
  const invalidate = useInvalidateTenancy()

  return useMutation(
    orpc.tenant.update.mutationOptions({
      onSuccess: async (_, input) => {
        await invalidate()
        toast.success(t("updated", { name: input.name }))
      },
    })
  )
}

export function useDeleteTenant() {
  const t = useTranslations("Tenants")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.tenant.remove.mutationOptions({
      onSuccess: async (_, input) => {
        // Its page is about to go away: drop it rather than refetch a 404.
        queryClient.removeQueries({
          queryKey: orpc.tenant.get.key({ input: { id: input.id } }),
        })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.tenant.list.key() }),
          queryClient.invalidateQueries({
            queryKey: orpc.business.listUsers.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.property.list.key(),
          }),
        ])
        toast.success(t("deleted"))
      },
    })
  )
}

export function useAddTenantNote() {
  const invalidate = useInvalidateTenancy()
  return useMutation(
    orpc.tenant.addNote.mutationOptions({ onSuccess: () => invalidate() })
  )
}

export function useRemoveTenantNote() {
  const invalidate = useInvalidateTenancy()
  return useMutation(
    orpc.tenant.removeNote.mutationOptions({ onSuccess: () => invalidate() })
  )
}

export function useCreateLease() {
  const t = useTranslations("Leases")
  const invalidate = useInvalidateTenancy()

  return useMutation(
    orpc.lease.create.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("created"))
      },
    })
  )
}

export function useUpdateLease() {
  const t = useTranslations("Leases")
  const invalidate = useInvalidateTenancy()

  return useMutation(
    orpc.lease.update.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("updated"))
      },
    })
  )
}

export function useTerminateLease() {
  const invalidate = useInvalidateTenancy()
  return useMutation(
    orpc.lease.terminate.mutationOptions({ onSuccess: () => invalidate() })
  )
}

export function useDeleteLease() {
  const t = useTranslations("Leases")
  const invalidate = useInvalidateTenancy()

  return useMutation(
    orpc.lease.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("deleted"))
      },
    })
  )
}

export function useAddPayment() {
  const t = useTranslations("Leases")
  const invalidate = useInvalidateTenancy()

  return useMutation(
    orpc.lease.addPayment.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("paymentRecorded"))
      },
    })
  )
}

export function useRemovePayment() {
  const invalidate = useInvalidateTenancy()
  return useMutation(
    orpc.lease.removePayment.mutationOptions({ onSuccess: () => invalidate() })
  )
}
