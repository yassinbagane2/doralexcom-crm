"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { authClient } from "@/lib/auth-client"

/**
 * Re-renders server components with the user as it is now. Pages take the
 * user from the session on the server, and the session cookie caches it for
 * five minutes, so a profile change needs both steps:
 *   1. re-read the session past the cache, which also rewrites the cookie;
 *   2. ask Next to render the current route again with that cookie.
 */
export function useRefreshSession() {
  const router = useRouter()

  return useCallback(async () => {
    await authClient.getSession({ query: { disableCookieCache: true } })
    router.refresh()
  }, [router])
}
