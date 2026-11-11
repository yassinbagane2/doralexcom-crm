"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { z } from "zod"

/** "1250,50" and "1250.50" both read as 1250.5; blank reads as null. */
export function parseAmount(value: string): number | null | typeof Number.NaN {
  const trimmed = value.replace(/\s/g, "")
  if (!trimmed) return null
  const number = Number(trimmed.replace(",", "."))
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : Number.NaN
}

/**
 * A schema for a money field typed as text: required or not, never negative,
 * at most `max`.
 */
export function useAmount() {
  const t = useTranslations("Leases.validation")
  return useMemo(
    () =>
      ({ required, max }: { required: boolean; max: number }) =>
        z.string().transform((value, ctx) => {
          const amount = parseAmount(value)
          if (amount === null) {
            if (!required) return 0
            ctx.addIssue({ code: "custom", message: t("amountRequired") })
            return z.NEVER
          }
          if (Number.isNaN(amount) || amount < 0 || amount > max) {
            ctx.addIssue({ code: "custom", message: t("amountInvalid") })
            return z.NEVER
          }
          if (required && amount === 0) {
            ctx.addIssue({ code: "custom", message: t("amountRequired") })
            return z.NEVER
          }
          return amount
        }),
    [t]
  )
}
