"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { useRefreshSession } from "@/hooks/use-refresh-session"
import { authClient, unwrap } from "@/lib/auth-client"

/*
 * Enabling 2FA takes two steps: `enable` returns the TOTP secret and backup
 * codes, and 2FA only switches on once `confirm` proves the app is set up.
 */

export function useEnableTwoFactor() {
  const t = useTranslations("AccountTwoFactor")

  return useMutation({
    mutationFn: async (password: string) => {
      const result = await unwrap(authClient.twoFactor.enable({ password }))

      // Only TOTP is configured; the plugin can also run email/SMS codes.
      if (result.method !== "totp") {
        throw new Error(t("totpUnavailable"))
      }

      return result
    },
  })
}

export function useConfirmTwoFactor() {
  const t = useTranslations("AccountTwoFactor")
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (code: string) =>
      unwrap(authClient.twoFactor.verifyTotp({ code })),
    onSuccess: async () => {
      await refreshSession()
      toast.success(t("enabled"))
    },
  })
}

export function useDisableTwoFactor() {
  const t = useTranslations("AccountTwoFactor")
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (password: string) =>
      unwrap(authClient.twoFactor.disable({ password })),
    onSuccess: async () => {
      await refreshSession()
      toast.success(t("disabled"))
    },
  })
}

export function useGenerateBackupCodes() {
  return useMutation({
    mutationFn: (password: string) =>
      unwrap(authClient.twoFactor.generateBackupCodes({ password })),
  })
}
