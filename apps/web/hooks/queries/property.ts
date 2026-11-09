"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * A business's properties, through the API's property router: every call is
 * scoped server-side to the organization the business owns.
 */

export type Property = Awaited<
  ReturnType<typeof orpc.property.list.call>
>[number]

export type PropertyInput = Parameters<typeof orpc.property.create.call>[0]

export function useProperties() {
  return useQuery(orpc.property.list.queryOptions())
}

function useInvalidateProperties() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.property.list.key() })
}

export function useCreateProperty() {
  const t = useTranslations("Properties")
  const invalidate = useInvalidateProperties()

  return useMutation(
    orpc.property.create.mutationOptions({
      onSuccess: async (_, input) => {
        await invalidate()
        toast.success(t("created", { name: input.name }))
      },
    })
  )
}

export function useUpdateProperty() {
  const t = useTranslations("Properties")
  const invalidate = useInvalidateProperties()

  return useMutation(
    orpc.property.update.mutationOptions({
      onSuccess: async (_, input) => {
        await invalidate()
        toast.success(t("updated", { name: input.name }))
      },
    })
  )
}

export function useDeleteProperty() {
  const t = useTranslations("Properties")
  const invalidate = useInvalidateProperties()

  return useMutation(
    orpc.property.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("deleted"))
      },
      // A refused delete usually means a tenant moved in since the list
      // loaded: refresh so the row shows who.
      onError: () => void invalidate(),
    })
  )
}
