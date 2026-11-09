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

/**
 * The organization the signed-in user is working in: the session's active one,
 * or their first if the session predates it. Null until onboarding creates one.
 */
export const getActiveOrganization = cache(async () => {
  const session = await requireSession()
  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })

  return (
    organizations.find(
      (org) => org.id === session.session.activeOrganizationId
    ) ??
    organizations[0] ??
    null
  )
})

/** For pages inside the app shell: no organization yet means onboarding. */
export async function requireOrganization() {
  const organization = await getActiveOrganization()

  if (!organization) {
    redirect(routes.onboarding)
  }

  return organization
}
