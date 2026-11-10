"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { routes } from "@/config/routes"
import { orpc } from "@/lib/orpc"

/*
 * Customers, their leases and the rent paid on them, through the API's customer
 * and lease routers. Every business call is scoped server-side to the
 * organization the business owns.
 */

export type CustomerSummary = Awaited<
  ReturnType<typeof orpc.customer.list.call>
>[number]
export type CustomerDetail = Awaited<ReturnType<typeof orpc.customer.get.call>>
export type CustomerLease = CustomerDetail["leases"][number]
export type CustomerInput = Parameters<typeof orpc.customer.create.call>[0]
export type LeaseTerms = Omit<
  Parameters<typeof orpc.lease.create.call>[0],
  "customerId" | "propertyId"
>
export type LeaseBalance = Awaited<ReturnType<typeof orpc.lease.terminate.call>>

export function useCustomers() {
  return useQuery(orpc.customer.list.queryOptions())
}

export function useCustomer(id: string) {
  return useQuery(orpc.customer.get.queryOptions({ input: { id } }))
}

export function useMyHome() {
  return useQuery(orpc.customer.mine.queryOptions())
}

/**
 * Anything about a customer can change what the customer list, the customer's page
 * and the property list show (occupants come from leases), so refresh all.
 */
function useInvalidateCustomers() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.customer.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.property.list.key() }),
      // Customers are the business's users: the users page lists them too.
      queryClient.invalidateQueries({
        queryKey: orpc.business.listUsers.key(),
      }),
    ])
}

export function useCreateCustomer() {
  const t = useTranslations("Customers")
  const invalidate = useInvalidateCustomers()

  return useMutation(
    orpc.customer.create.mutationOptions({
      onSuccess: async (_, input) => {
        await invalidate()
        toast.success(t("created", { name: input.name }))
      },
    })
  )
}

export function useUpdateCustomer() {
  const t = useTranslations("Customers")
  const invalidate = useInvalidateCustomers()

  return useMutation(
    orpc.customer.update.mutationOptions({
      onSuccess: async (_, input) => {
        await invalidate()
        toast.success(t("updated", { name: input.name }))
      },
    })
  )
}

export function useDeleteCustomer() {
  const t = useTranslations("Customers")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.customer.remove.mutationOptions({
      onSuccess: async (_, input) => {
        // Its page is about to go away: drop it rather than refetch a 404.
        queryClient.removeQueries({
          queryKey: orpc.customer.get.key({ input: { id: input.id } }),
        })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.customer.list.key() }),
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

export function useAddCustomerNote() {
  const invalidate = useInvalidateCustomers()
  return useMutation(
    orpc.customer.addNote.mutationOptions({ onSuccess: () => invalidate() })
  )
}

export function useRemoveCustomerNote() {
  const invalidate = useInvalidateCustomers()
  return useMutation(
    orpc.customer.removeNote.mutationOptions({ onSuccess: () => invalidate() })
  )
}

/**
 * Assigns a property along with its lease document; the toast offers to open
 * the document, to review and print it for signing.
 */
export function useCreateLease() {
  const t = useTranslations("Leases")
  const router = useRouter()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateCustomers()

  return useMutation(
    orpc.lease.create.mutationOptions({
      onSuccess: async ({ documentId }, { customerId }) => {
        await Promise.all([
          invalidate(),
          queryClient.invalidateQueries({
            queryKey: orpc.document.list.key(),
          }),
        ])
        toast.success(t("created"), {
          description: t("documentCreated"),
          action: {
            label: t("openDocument"),
            onClick: (shown) => {
              toast.dismiss(shown.id)
              router.push(
                `${routes.customers}/${customerId}/contracts/${documentId}`
              )
            },
          },
        })
      },
    })
  )
}

export function useUpdateLease() {
  const t = useTranslations("Leases")
  const invalidate = useInvalidateCustomers()

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
  const invalidate = useInvalidateCustomers()
  return useMutation(
    orpc.lease.terminate.mutationOptions({ onSuccess: () => invalidate() })
  )
}

export function useDeleteLease() {
  const t = useTranslations("Leases")
  const invalidate = useInvalidateCustomers()

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
  const invalidate = useInvalidateCustomers()

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
  const invalidate = useInvalidateCustomers()
  return useMutation(
    orpc.lease.removePayment.mutationOptions({ onSuccess: () => invalidate() })
  )
}
