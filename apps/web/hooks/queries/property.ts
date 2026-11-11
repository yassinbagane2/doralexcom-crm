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
import { useState } from "react"

import { shrinkImage } from "@/lib/images"
import { orpc } from "@/lib/orpc"
import { serverUrl } from "@/lib/server-url"

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

/** One of the property's photos, as returned with it. */
export type PropertyPhoto = PropertyDetail["photos"][number]

/**
 * Where an <img> loads a photo from. The API serves it with the session
 * cookie, like every other call (see apps/server/src/index.ts).
 */
export function propertyPhotoUrl(id: string) {
  return `${serverUrl()}/files/property-photos/${id}`
}

/**
 * Shrinks and uploads photos one after another, so they land in the order
 * picked. `progress` counts them while it runs. Pictures the browser can't
 * read are skipped and reported; the rest still go up.
 */
export function useUploadPropertyPhotos(propertyId: string) {
  const t = useTranslations("Properties.photos")
  const invalidate = useInvalidateProperties()
  const upload = useMutation(orpc.propertyPhoto.upload.mutationOptions())
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  const run = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"))
    if (images.length < files.length) toast.error(t("notImages"))
    if (images.length === 0) return 0

    let sent = 0
    let unreadable = 0
    setProgress({ done: 0, total: images.length })
    try {
      for (const [index, image] of images.entries()) {
        let file: File
        try {
          file = await shrinkImage(image)
        } catch {
          unreadable += 1
          continue
        }
        try {
          await upload.mutateAsync({ propertyId, file })
          sent += 1
        } catch {
          // Already toasted; a full property won't take the rest either.
          break
        } finally {
          setProgress({ done: index + 1, total: images.length })
        }
      }
    } finally {
      setProgress(null)
      if (sent > 0) await invalidate()
    }

    if (unreadable > 0) toast.error(t("unreadable", { count: unreadable }))
    if (sent > 0) toast.success(t("uploaded", { count: sent }))
    return sent
  }

  return { upload: run, progress, uploading: progress !== null }
}

export function useDeletePropertyPhoto() {
  const t = useTranslations("Properties.photos")
  const invalidate = useInvalidateProperties()

  return useMutation(
    orpc.propertyPhoto.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("deleted"))
      },
    })
  )
}

/** Saves a new order; the cached property shows it straight away. */
export function useReorderPropertyPhotos() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateProperties()

  return useMutation(
    orpc.propertyPhoto.reorder.mutationOptions({
      onMutate: ({ propertyId, ids }) => {
        const key = orpc.property.get.queryKey({ input: { id: propertyId } })
        const previous = queryClient.getQueryData<PropertyDetail>(key)
        if (previous) {
          queryClient.setQueryData<PropertyDetail>(key, {
            ...previous,
            photos: ids.map((id) => ({ id })),
          })
        }
        return { key, previous }
      },
      onError: (_, __, context) => {
        if (context?.previous) {
          queryClient.setQueryData(context.key, context.previous)
        }
      },
      onSettled: () => invalidate(),
    })
  )
}
