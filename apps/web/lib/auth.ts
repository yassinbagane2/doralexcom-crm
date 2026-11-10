import "server-only"

import { auth } from "@workspace/auth"
import { getUserRole, type UserRole } from "@workspace/auth/roles"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { homeRouteFor, routes } from "@/config/routes"

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

/** The signed-in user's role, defaulting to the least privileged. */
export async function getRole() {
  const session = await requireSession()
  return getUserRole(session.user.role)
}

/**
 * For pages only some roles may see. Anyone else is sent to their own home
 * instead of a dead end.
 */
export async function requireRole(...allowed: UserRole[]) {
  const session = await requireSession()
  const role = getUserRole(session.user.role)

  if (!allowed.includes(role)) {
    redirect(homeRouteFor(role))
  }

  return { ...session, role }
}

/**
 * The signed-in user's role inside their organization: "owner" for the
 * business account that set it up, "collaborator" for the people it invited,
 * "member" for customers. Null outside any organization (admins).
 */
export const getMemberRole = cache(async () => {
  // The organization the app shell works in, even for a session that
  // predates `activeOrganizationId`.
  const organization = await getActiveOrganization()
  if (!organization) return null

  const member = await auth.api
    .getActiveMemberRole({
      headers: await headers(),
      query: { organizationId: organization.id },
    })
    .catch(() => null)

  return member?.role ?? null
})

/**
 * For the business's settings: its owner only. Collaborators are sent to
 * their own account page instead.
 */
export async function requireOwner() {
  const session = await requireRole("business")
  if ((await getMemberRole()) !== "owner") {
    redirect(routes.account)
  }
  return session
}
