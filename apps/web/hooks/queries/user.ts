"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { routes } from "@/config/routes"
import { useRefreshSession } from "@/hooks/use-refresh-session"
import { authClient, unwrap } from "@/lib/auth-client"
import { orpc } from "@/lib/orpc"

/** Account summary from the API server's own oRPC router. */
export function useAccountOverview() {
  return useQuery(orpc.user.overview.queryOptions())
}

export function useUpdateProfile() {
  const t = useTranslations("AccountProfile")
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (input: { name: string }) =>
      unwrap(authClient.updateUser(input)),
    onSuccess: async () => {
      await refreshSession()
      toast.success(t("updated"))
    },
  })
}

export function useChangePassword() {
  const t = useTranslations("AccountPassword")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      unwrap(
        authClient.changePassword({ ...input, revokeOtherSessions: true })
      ),
    onSuccess: () => {
      // Other devices were signed out, so their sessions are gone.
      void queryClient.invalidateQueries()
      toast.success(t("changed"))
    },
  })
}

export function useSendVerificationEmail() {
  const t = useTranslations("AccountVerifyEmail")

  return useMutation({
    mutationFn: (email: string) =>
      unwrap(
        authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        })
      ),
    onSuccess: () => toast.success(t("sent")),
  })
}

export function useVerifyEmail() {
  const t = useTranslations("AccountVerifyEmail")
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (input: { email: string; otp: string }) =>
      unwrap(authClient.emailOtp.verifyEmail(input)),
    onSuccess: async () => {
      await refreshSession()
      toast.success(t("verified"))
    },
  })
}

export function useDeleteAccount() {
  const t = useTranslations("AccountDelete")
  const router = useRouter()

  return useMutation({
    mutationFn: (password: string) =>
      unwrap(authClient.deleteUser({ password })),
    onSuccess: () => {
      toast.success(t("deleted"))
      router.replace(routes.home)
      router.refresh()
    },
  })
}
