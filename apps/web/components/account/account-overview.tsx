"use client"

import { useLocale, useTranslations } from "next-intl"

import { useAccountOverview } from "@/hooks/queries/user"
import { formatDate } from "@/lib/format"

/** Read from the API server's own oRPC router, not from Better Auth. */
export function AccountOverview() {
  const t = useTranslations("AccountOverview")
  const locale = useLocale()
  const { data, isPending } = useAccountOverview()

  function describeSignInMethods(hasPassword: boolean, passkeyCount: number) {
    const methods = hasPassword ? [t("password")] : []

    if (passkeyCount > 0) {
      methods.push(t("passkeyCount", { count: passkeyCount }))
    }

    return methods.join(", ") || t("none")
  }

  const items = [
    {
      label: t("memberSince"),
      value: data && formatDate(data.memberSince, locale),
    },
    {
      label: t("signInMethods"),
      value: data && describeSignInMethods(data.hasPassword, data.passkeyCount),
    },
    {
      label: t("activeSessions"),
      value: data && String(data.activeSessionCount),
    },
  ]

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium">
            {isPending ? (
              <span className="block h-5 w-20 animate-pulse rounded bg-muted" />
            ) : (
              (value ?? "—")
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
