"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"

import { AuthError } from "@/lib/auth-client"

/**
 * Turns a failed request into a message in the active language. Better Auth
 * errors carry a stable `code`; known codes are translated, anything else
 * falls back to the server's own (English) message.
 */
export function useErrorMessage() {
  const t = useTranslations("Errors")

  return useCallback(
    (error: unknown) => {
      if (error instanceof AuthError && error.code) {
        const key = error.code as Parameters<typeof t>[0]
        if (t.has(key)) return t(key)
      }

      if (error instanceof Error && error.message) return error.message

      return t("generic")
    },
    [t]
  )
}
