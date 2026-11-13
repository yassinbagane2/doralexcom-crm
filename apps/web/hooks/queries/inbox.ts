"use client"

import { useQuery } from "@tanstack/react-query"
import type { InboxSession } from "@workspace/novu/types"
import { useLocale } from "next-intl"

import { serverUrl } from "@/lib/server-url"

/**
 * The signed-in user's Novu inbox credentials, from the API server's
 * /novu/inbox (a plain Hono route, not oRPC). They only change with the
 * user, so they're fetched once per session. The locale rides along so Novu
 * emails the user in the language they use the app in.
 */
export function useInboxSession() {
  const locale = useLocale()

  return useQuery({
    queryKey: ["novu", "inbox-session", locale],
    queryFn: async ({ signal }) => {
      const url = new URL(`${serverUrl()}/novu/inbox`)
      url.searchParams.set("locale", locale)
      const response = await fetch(url, { credentials: "include", signal })
      if (!response.ok) {
        throw new Error(`Inbox session failed (${response.status})`)
      }
      return (await response.json()) as InboxSession
    },
    staleTime: Infinity,
    retry: 1,
    // The bell simply stays hidden: no reason to interrupt with a toast.
    meta: { silent: true },
  })
}
