import type { UserRole } from "@workspace/auth/roles"

export const routes = {
  home: "/",
  signIn: "/sign-in",
  forgotPassword: "/forgot-password",
  twoFactor: "/two-factor",
  /** Public: where an invitation email lands, signed in or not. */
  invite: "/invite",
  onboarding: "/onboarding",
  account: "/account",
  accountSecurity: "/account/security",
  accountOrganization: "/account/organization",
  accountPreferences: "/account/preferences",
  /** Business accounts: who else works on the business's records. */
  accountCollaborators: "/account/collaborators",
  /** Business owners: the email service the business sends through. */
  accountEmail: "/account/email",
  /** Business owners: the business's own web address. */
  accountDomain: "/account/domain",
  /** Business accounts: the signature the business signs contracts with. */
  accountSignature: "/account/signature",
  /** Business accounts: where they land after signing in. */
  dashboard: "/dashboard",
  /** Business accounts: the properties they rent out. */
  properties: "/properties",
  /** Business accounts: the people they rent to. */
  customers: "/customers",
  /** Business accounts: contract templates, filled in for each lease. */
  templates: "/templates",
  /** Businesses and customers: messages with each other, and notifications. */
  inbox: "/inbox",
  /** User accounts linked to a customer record: their own leases and notes. */
  myHome: "/my-home",
  /** The page the API's headless Chrome prints a signed contract from. */
  print: "/print",
  admin: "/admin",
  adminUsers: "/admin/users",
} as const

/** The page for one invitation, and its create-account step. */
export function inviteRoute(invitationId: string, step?: "create-account") {
  const path = `${routes.invite}/${encodeURIComponent(invitationId)}`
  return step ? `${path}/${step}` : path
}

/** One property's page, or its edit form. */
export function propertyRoute(propertyId: string, step?: "edit") {
  const path = `${routes.properties}/${encodeURIComponent(propertyId)}`
  return step ? `${path}/${step}` : path
}

/** The form for a new property, started from a copy of `from` if given. */
export function newPropertyRoute(from?: string) {
  const path = `${routes.properties}/new`
  return from ? `${path}?${new URLSearchParams({ from })}` : path
}

/** Sign-in, coming back to `path` afterwards. */
export function signInRoute(path: string) {
  return `${routes.signIn}?${new URLSearchParams({ [REDIRECT_PARAM]: path })}`
}

/** Where each kind of account starts out after signing in. */
export function homeRouteFor(role: UserRole) {
  if (role === "admin") return routes.admin
  if (role === "business") return routes.dashboard
  return DEFAULT_SIGNED_IN_ROUTE
}

/** Where businesses and users land after signing in, when nothing else was requested. */
export const DEFAULT_SIGNED_IN_ROUTE = routes.account

/** Need a session. Each entry also covers everything nested under it. */
export const PROTECTED_ROUTES: readonly string[] = [
  routes.account,
  routes.onboarding,
  routes.dashboard,
  routes.properties,
  routes.customers,
  routes.templates,
  routes.myHome,
  routes.inbox,
  routes.admin,
]

/** Admins only. Everyone else is sent to their own home. */
export const ADMIN_ROUTES: readonly string[] = [routes.admin]

/** Only make sense signed out. Signed-in visitors are sent on instead. */
export const AUTH_ROUTES: readonly string[] = [
  routes.signIn,
  routes.forgotPassword,
  routes.twoFactor,
]

/** Query parameter carrying the page to return to after signing in. */
export const REDIRECT_PARAM = "redirectTo"

export function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

/**
 * Accepts only same-origin paths. `redirectTo` arrives from the URL, so
 * without this check `//evil.com` would turn sign-in into an open redirect.
 */
export function safeRedirectPath(
  param: string | string[] | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_ROUTE
) {
  const value = Array.isArray(param) ? param[0] : param

  if (!value || !value.startsWith("/") || /^\/[/\\]/.test(value)) {
    return fallback
  }

  return value
}

/** A contract sent to the signed-in customer: to read and sign. */
export function myDocumentRoute(documentId: string) {
  return `${routes.myHome}/documents/${encodeURIComponent(documentId)}`
}

/** The signed-in customer's receipt for one payment. */
export function myReceiptRoute(paymentId: string) {
  return `${routes.myHome}/receipts/${encodeURIComponent(paymentId)}`
}

/** The inbox, opened on a conversation, or on the one with a customer. */
export function inboxRoute(
  open?: { conversation: string } | { customer: string }
) {
  return open ? `${routes.inbox}?${new URLSearchParams(open)}` : routes.inbox
}
