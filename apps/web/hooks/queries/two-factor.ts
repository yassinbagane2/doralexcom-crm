"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/ui/sonner"

import { useRefreshSession } from "@/hooks/use-refresh-session"
import { authClient, unwrap } from "@/lib/auth-client"

/*
 * Enabling 2FA takes two steps: `enable` returns the TOTP secret and backup
 * codes, and 2FA only switches on once `confirm` proves the app is set up.
 * Errors in the setup dialog are shown inline, so these two don't toast.
 */

export function useEnableTwoFactor() {
  return useMutation({
    mutationFn: async (password: string) => {
      const result = await unwrap(authClient.twoFactor.enable({ password }))

      // Only TOTP is configured; the plugin can also run email/SMS codes.
      if (result.method !== "totp") {
        throw new Error("Authenticator app setup isn't available.")
      }

      return result
    },
  })
}

export function useConfirmTwoFactor() {
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (code: string) =>
      unwrap(authClient.twoFactor.verifyTotp({ code })),
    onSuccess: async () => {
      await refreshSession()
      toast.success("Two-factor authentication is on")
    },
  })
}

export function useDisableTwoFactor() {
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (password: string) =>
      unwrap(authClient.twoFactor.disable({ password })),
    onSuccess: async () => {
      await refreshSession()
      toast.success("Two-factor authentication is off")
    },
  })
}

export function useGenerateBackupCodes() {
  return useMutation({
    mutationFn: (password: string) =>
      unwrap(authClient.twoFactor.generateBackupCodes({ password })),
  })
}
