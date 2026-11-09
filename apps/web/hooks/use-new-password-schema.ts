"use client"

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SPECIAL_CHARACTER_PATTERN,
  UPPERCASE_PATTERN,
} from "@workspace/auth/password"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { z } from "zod"

/**
 * `newPasswordSchema` from `@workspace/auth/password`, with its messages in the
 * active language. Same rules, so the server hook and the form still agree.
 */
export function useNewPasswordSchema() {
  const t = useTranslations("Validation")

  return useMemo(
    () =>
      z
        .string()
        .min(
          PASSWORD_MIN_LENGTH,
          t("passwordTooShort", { min: PASSWORD_MIN_LENGTH })
        )
        .max(
          PASSWORD_MAX_LENGTH,
          t("passwordTooLong", { max: PASSWORD_MAX_LENGTH })
        )
        .regex(UPPERCASE_PATTERN, t("passwordUppercase"))
        .regex(SPECIAL_CHARACTER_PATTERN, t("passwordSpecial")),
    [t]
  )
}
