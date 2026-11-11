"use client"

import type { SignerRole } from "@workspace/api/contract"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"

import type { SignatureFieldOptions } from "./signature-field"

/** How signature fields read in the reader's language. */
export function useSignatureLabels(): SignatureFieldOptions {
  const t = useTranslations("Signing.field")
  const format = useFormatter()

  return useMemo(
    () => ({
      label: (role: SignerRole) => t(role),
      caption: (name: string, signedAt: string) => {
        const date = new Date(signedAt)
        return Number.isNaN(date.getTime())
          ? name
          : t("caption", {
              name,
              date: format.dateTime(date, { dateStyle: "medium" }),
            })
      },
    }),
    [t, format]
  )
}
