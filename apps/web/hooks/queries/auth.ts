"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { routes } from "@/config/routes"
import { authClient, unwrap } from "@/lib/auth-client"

/*
 * Sign-in and recovery flows. These hooks don't toast: each form shows its
 * own error inline, next to the fields it's about.
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

export function useSignUp() {
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      unwrap(authClient.signUp.email(input)),
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
      method,
      code,
      trustDevice,
    }: {
      method: "totp" | "backup-code"
      code: string
      trustDevice: boolean
    }) =>
      method === "totp"
        ? unwrap(authClient.twoFactor.verifyTotp({ code, trustDevice }))
        : unwrap(authClient.twoFactor.verifyBackupCode({ code, trustDevice })),
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
