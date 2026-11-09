"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/ui/sonner"
import { useRouter } from "next/navigation"

import { routes } from "@/config/routes"
import { useRefreshSession } from "@/hooks/use-refresh-session"
import { authClient, unwrap } from "@/lib/auth-client"
import { orpc } from "@/lib/orpc"

/** Account summary from the API server's own oRPC router. */
export function useAccountOverview() {
  return useQuery(orpc.user.overview.queryOptions())
}

export function useUpdateProfile() {
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (input: { name: string }) =>
      unwrap(authClient.updateUser(input)),
    onSuccess: async () => {
      await refreshSession()
      toast.success("Profile updated")
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      unwrap(
        authClient.changePassword({ ...input, revokeOtherSessions: true })
      ),
    onSuccess: () => {
      // Other devices were signed out, so their sessions are gone.
      void queryClient.invalidateQueries()
      toast.success("Password changed. Other devices were signed out.")
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useSendVerificationEmail() {
  return useMutation({
    mutationFn: (email: string) =>
      unwrap(
        authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        })
      ),
    onSuccess: () => toast.success("Verification code sent"),
    onError: (error) => toast.error(error.message),
  })
}

export function useVerifyEmail() {
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (input: { email: string; otp: string }) =>
      unwrap(authClient.emailOtp.verifyEmail(input)),
    onSuccess: async () => {
      await refreshSession()
      toast.success("Email verified")
    },
  })
}

export function useDeleteAccount() {
  const router = useRouter()

  return useMutation({
    mutationFn: (password: string) =>
      unwrap(authClient.deleteUser({ password })),
    onSuccess: () => {
      toast.success("Your account has been deleted")
      router.replace(routes.home)
      router.refresh()
    },
  })
}
