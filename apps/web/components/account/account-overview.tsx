"use client"

import { useAccountOverview } from "@/hooks/queries/user"
import { formatDate } from "@/lib/format"

/** Read from the API server's own oRPC router, not from Better Auth. */
export function AccountOverview() {
  const { data, isPending } = useAccountOverview()

  const items = [
    { label: "Member since", value: data && formatDate(data.memberSince) },
    {
      label: "Sign-in methods",
      value: data && describeSignInMethods(data.hasPassword, data.passkeyCount),
    },
    {
      label: "Active sessions",
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

function describeSignInMethods(hasPassword: boolean, passkeyCount: number) {
  const methods = hasPassword ? ["Password"] : []

  if (passkeyCount > 0) {
    methods.push(`${passkeyCount} passkey${passkeyCount === 1 ? "" : "s"}`)
  }

  return methods.join(", ") || "None"
}
