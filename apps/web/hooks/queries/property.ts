"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { nextOffsetPage, PAGE_SIZE } from "@workspace/api/pagination"
import type { PropertyType } from "@workspace/api/property"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * A business's properties, through the API's property router: every call is
 * scoped server-side to the organization the business owns.
 */

export type Property = Awaited<
  ReturnType<typeof orpc.property.list.call>
>["data"][number]

export type PropertyInput = Parameters<typeof orpc.property.create.call>[0]

/** One property with its whole lease history, for the property's page. */
export type PropertyDetail = Awaited<ReturnType<typeof orpc.property.get.call>>

/**
 * The business's properties, a page at a time (`fetchNextPage`) for infinite
 * scrolling, narrowed down by the server to `type` and `search`.
 */
export function usePropertyPages({
  search,
  type,
  enabled = true,
}: {
  search?: string
  type?: PropertyType
  enabled?: boolean
} = {}) {
  return useInfiniteQuery({
    ...orpc.property.list.infiniteOptions({
      input: (page: number) => ({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        type,
      }),
      initialPageParam: 1,
      getNextPageParam: nextOffsetPage,
    }),
    enabled,
    // Typing a search keeps the last results up until the new ones arrive.
    placeholderData: keepPreviousData,
  })
}

/** Totals for the page header, as of the reader's `today`. */
export function usePropertySummary(today: string) {
  return useQuery(orpc.property.summary.queryOptions({ input: { today } }))
}

export function useProperty(id: string | null) {
  return useQuery({
    ...orpc.property.get.queryOptions({ input: { id: id ?? "" } }),
    enabled: id !== null,
  })
}

function useInvalidateProperties() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: orpc.property.key() })
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
  const queryClient = useQueryClient()

  return useMutation(
    orpc.property.remove.mutationOptions({
      onSuccess: async (_, { id }) => {
        // Not the deleted property's own query: refetching it would only 404
        // while its page navigates away.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.property.list.key() }),
          queryClient.invalidateQueries({
            queryKey: orpc.property.summary.key(),
          }),
        ])
        queryClient.removeQueries({
          queryKey: orpc.property.get.key({ input: { id } }),
        })
        toast.success(t("deleted"))
      },
      // A refused delete usually means a customer moved in since the list
      // loaded: refresh so the row shows who.
      onError: () => void invalidate(),
    })
  )
}
