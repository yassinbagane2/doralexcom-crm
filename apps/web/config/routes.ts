export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  twoFactor: "/two-factor",
  onboarding: "/onboarding",
  account: "/account",
  accountSecurity: "/account/security",
  accountOrganization: "/account/organization",
  accountPreferences: "/account/preferences",
} as const

/** Where a visitor lands after signing in, when nothing else was requested. */
export const DEFAULT_SIGNED_IN_ROUTE = routes.account

/** Need a session. Each entry also covers everything nested under it. */
export const PROTECTED_ROUTES: readonly string[] = [
  routes.account,
  routes.onboarding,
]

/** Only make sense signed out. Signed-in visitors are sent on instead. */
export const AUTH_ROUTES: readonly string[] = [
  routes.signIn,
  routes.signUp,
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
export function safeRedirectPath(param: string | string[] | null | undefined) {
  const value = Array.isArray(param) ? param[0] : param

  if (!value || !value.startsWith("/") || /^\/[/\\]/.test(value)) {
    return DEFAULT_SIGNED_IN_ROUTE
  }

  return value
}
