"use client"

import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useTransition } from "react"

import { setLocale } from "@/i18n/actions"
import type { Locale } from "@/i18n/locale"

/**
 * Switches language without a full reload: store the cookie on the server,
 * then re-render the current route so server components pick it up.
 */
export function useChangeLocale() {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const changeLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return

      startTransition(async () => {
        await setLocale(next)
        router.refresh()
      })
    },
    [locale, router]
  )

  return { locale, changeLocale, isPending }
}
