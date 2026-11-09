import "server-only"

import { auth } from "@workspace/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { routes } from "@/config/routes"

/** The current session, read once per request however many components ask. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
)

/**
 * For pages behind a session. proxy.ts already redirects signed-out visitors;
 * this is the second check, so a page never trusts the proxy alone.
 */
export async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect(routes.signIn)
  }

  return session
}
