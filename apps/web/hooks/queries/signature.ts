"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { orpc } from "@/lib/orpc"

/** The signature the business signs its contracts with; null until set. */
export function useBusinessSignature() {
  return useQuery(orpc.signature.get.queryOptions())
}

export function useSaveBusinessSignature() {
  const t = useTranslations("SignatureSettings")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.signature.save.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.signature.key(),
        })
        toast.success(t("saved"))
      },
    })
  )
}

export function useRemoveBusinessSignature() {
  const t = useTranslations("SignatureSettings")
  const queryClient = useQueryClient()

  return useMutation(
    orpc.signature.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.signature.key(),
        })
        toast.success(t("removed"))
      },
    })
  )
}
