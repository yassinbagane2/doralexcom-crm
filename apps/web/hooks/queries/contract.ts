"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/*
 * Contract templates, and the documents kept about each tenant (uploaded
 * files and contracts generated from templates), through the API's contract
 * and document routers. Every call is scoped server-side to the business's
 * organization.
 */

export type ContractTemplateSummary = Awaited<
  ReturnType<typeof orpc.contract.listTemplates.call>
>[number]
export type ContractTemplate = Awaited<
  ReturnType<typeof orpc.contract.getTemplate.call>
>
export type ContractMergeData = Awaited<
  ReturnType<typeof orpc.contract.mergeData.call>
>
export type TenantDocument = Awaited<
  ReturnType<typeof orpc.document.list.call>
>[number]

export function useContractTemplates() {
  return useQuery(orpc.contract.listTemplates.queryOptions())
}

export function useContractTemplate(id: string) {
  return useQuery(
    orpc.contract.getTemplate.queryOptions({
      input: { id },
      // The editor takes its content once; a background refetch would only
      // make a stale copy look current.
      staleTime: Number.POSITIVE_INFINITY,
    })
  )
}

function useInvalidateTemplates() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.contract.listTemplates.key(),
    })
}

export function useCreateContractTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation(
    orpc.contract.createTemplate.mutationOptions({
      onSuccess: () => invalidate(),
    })
  )
}

/**
 * A template's content for its card preview, fetched once the card is seen.
 * Keyed on `updatedAt`, so an edited template is fetched again.
 */
export function useContractTemplatePreview(
  template: Pick<ContractTemplateSummary, "id" | "updatedAt">,
  enabled: boolean
) {
  const input = { id: template.id }
  return useQuery(
    orpc.contract.getTemplate.queryOptions({
      input,
      queryKey: [
        ...orpc.contract.getTemplate.queryKey({ input }),
        new Date(template.updatedAt).getTime(),
      ],
      enabled,
      staleTime: Number.POSITIVE_INFINITY,
      // The old page stays up while an edited one loads.
      placeholderData: keepPreviousData,
      retry: false,
      // Without a preview the card just shows a blank page; not worth a toast.
      meta: { silent: true },
    })
  )
}

export function useUpdateContractTemplate() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateTemplates()
  return useMutation(
    orpc.contract.updateTemplate.mutationOptions({
      onSuccess: (_, input) => {
        // The editor's copy never refetches, so reopening the template
        // would otherwise show it as it was before this save.
        queryClient.setQueryData(
          orpc.contract.getTemplate.queryKey({ input: { id: input.id } }),
          (old) =>
            old && {
              ...old,
              name: input.name,
              content: input.content,
              updatedAt: new Date(),
            }
        )
        return invalidate()
      },
    })
  )
}

export function useDeleteContractTemplate() {
  const t = useTranslations("Contracts")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.contract.removeTemplate.mutationOptions({
      onSuccess: async (_, input) => {
        queryClient.removeQueries({
          queryKey: orpc.contract.getTemplate.key({ input: { id: input.id } }),
        })
        await queryClient.invalidateQueries({
          queryKey: orpc.contract.listTemplates.key(),
        })
        toast.success(t("deleted"))
      },
    })
  )
}

export function useTenantDocuments(tenantId: string) {
  return useQuery(orpc.document.list.queryOptions({ input: { tenantId } }))
}

function useInvalidateDocuments() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.document.list.key() })
}

export function useUploadDocument() {
  const t = useTranslations("Documents")
  const invalidate = useInvalidateDocuments()

  return useMutation(
    orpc.document.upload.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("uploaded"))
      },
    })
  )
}

export function useDeleteDocument() {
  const t = useTranslations("Documents")
  const invalidate = useInvalidateDocuments()

  return useMutation(
    orpc.document.remove.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success(t("deleted"))
      },
    })
  )
}

export function useCreateContractDocument() {
  const invalidate = useInvalidateDocuments()
  return useMutation(
    orpc.document.createContract.mutationOptions({
      onSuccess: () => invalidate(),
    })
  )
}

export function useContractDocument(id: string) {
  return useQuery(
    orpc.document.getContract.queryOptions({
      input: { id },
      staleTime: Number.POSITIVE_INFINITY,
    })
  )
}

export function useUpdateContractDocument() {
  const invalidate = useInvalidateDocuments()
  return useMutation(
    orpc.document.updateContract.mutationOptions({
      onSuccess: () => invalidate(),
    })
  )
}

export function useDownloadDocument() {
  return useMutation(orpc.document.download.mutationOptions())
}
