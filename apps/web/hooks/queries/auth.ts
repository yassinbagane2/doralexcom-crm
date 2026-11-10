"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { routes } from "@/config/routes"
import { authClient, unwrap } from "@/lib/auth-client"

/*
 * Sign-in and recovery flows. Failures toast from one place, see
 * `RequestErrorToasts` in components/providers.tsx.
 */

export function useSignIn() {
  return useMutation({
    mutationFn: (input: {
      email: string
      password: string
      rememberMe: boolean
    }) => unwrap(authClient.signIn.email(input)),
  })
}

export function usePasskeySignIn() {
  return useMutation({
    mutationFn: () => unwrap(authClient.signIn.passkey()),
  })
}

export function useVerifyTwoFactor() {
  return useMutation({
    mutationFn: ({
      code,
      trustDevice,
    }: {
      code: string
      trustDevice: boolean
    }) => unwrap(authClient.twoFactor.verifyTotp({ code, trustDevice })),
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      unwrap(
        authClient.emailOtp.sendVerificationOtp({
          email,
          type: "forget-password",
        })
      ),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { email: string; otp: string; password: string }) =>
      unwrap(authClient.emailOtp.resetPassword(input)),
  })
}

export function useSignOut() {
  const router = useRouter()

  return useMutation({
    mutationFn: () => unwrap(authClient.signOut()),
    onSuccess: () => {
      router.replace(routes.signIn)
      router.refresh()
    },
  })
}
