"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { authClient, unwrap } from "@/lib/auth-client"
import { orpc } from "@/lib/orpc"

export function usePasskeys() {
  return useQuery({
    queryKey: ["user-passkeys"],
    queryFn: () => unwrap(authClient.passkey.listUserPasskeys()),
  })
}

function useInvalidatePasskeys() {
  const queryClient = useQueryClient()

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["user-passkeys"] }),
      queryClient.invalidateQueries({ queryKey: orpc.user.overview.key() }),
    ])
}

export function useAddPasskey() {
  const t = useTranslations("AccountPasskeys")
  const invalidatePasskeys = useInvalidatePasskeys()

  return useMutation({
    mutationFn: (name: string) =>
      unwrap(authClient.passkey.addPasskey({ name: name || undefined })),
    onSuccess: async () => {
      await invalidatePasskeys()
      toast.success(t("added"))
    },
  })
}

export function useDeletePasskey() {
  const t = useTranslations("AccountPasskeys")
  const invalidatePasskeys = useInvalidatePasskeys()

  return useMutation({
    mutationFn: (id: string) =>
      unwrap(authClient.passkey.deletePasskey({ id })),
    onSuccess: async () => {
      await invalidatePasskeys()
      toast.success(t("removed"))
    },
  })
}
