"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * A business's own users, through the API's business router: every call is
 * scoped server-side to the organization the business owns.
 */

export function useBusinessUsers() {
  return useQuery(orpc.business.listUsers.queryOptions())
}

export function useCreateBusinessUser() {
  const t = useTranslations("BusinessUsers")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.business.createUser.mutationOptions({
      onSuccess: async (_, input) => {
        // A business's users are its customers: refresh both views of them,
        // and the properties whose occupants they are.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.business.listUsers.key(),
          }),
          queryClient.invalidateQueries({ queryKey: orpc.customer.key() }),
          queryClient.invalidateQueries({
            queryKey: orpc.property.list.key(),
          }),
        ])
        toast.success(t("created", { email: input.email }))
      },
    })
  )
}

export function useRemoveBusinessUser() {
  const t = useTranslations("BusinessUsers")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.business.removeUser.mutationOptions({
      onSuccess: async () => {
        // A business's users are its customers: refresh both views of them,
        // and the properties whose occupants they are.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.business.listUsers.key(),
          }),
          queryClient.invalidateQueries({ queryKey: orpc.customer.key() }),
          queryClient.invalidateQueries({
            queryKey: orpc.property.list.key(),
          }),
        ])
        toast.success(t("removed"))
      },
    })
  )
}
