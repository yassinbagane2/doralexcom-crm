import { auth } from "@workspace/auth"
import { getUserRole } from "@workspace/auth/roles"
import { NextResponse, type NextRequest } from "next/server"

import {
  ADMIN_ROUTES,
  AUTH_ROUTES,
  homeRouteFor,
  matchesRoute,
  PROTECTED_ROUTES,
  REDIRECT_PARAM,
  routes,
  safeRedirectPath,
} from "@/config/routes"

/**
 * Route protection. Signed-out visitors to a protected page go to sign-in
 * (remembering where they were headed); signed-in visitors to an auth page
 * skip past it; only admins get into the admin dashboard. Pages still check
 * the session themselves; this only decides where a request should land.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl

  const isProtected = PROTECTED_ROUTES.some((route) =>
    matchesRoute(pathname, route)
  )
  const isAuthRoute = AUTH_ROUTES.some((route) => matchesRoute(pathname, route))

  // Everything else is public: skip the session lookup entirely.
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next()
  }

  // Validated, not just "a cookie exists": a revoked or expired session must
  // not count. The cookie cache keeps this from hitting the database each time.
  const session = await auth.api.getSession({ headers: request.headers })

  if (isProtected && !session) {
    const signIn = new URL(routes.signIn, request.url)
    signIn.searchParams.set(REDIRECT_PARAM, `${pathname}${search}`)
    return NextResponse.redirect(signIn)
  }

  const role = getUserRole(session?.user.role)

  if (isAuthRoute && session) {
    const destination = safeRedirectPath(
      searchParams.get(REDIRECT_PARAM),
      homeRouteFor(role)
    )
    return NextResponse.redirect(new URL(destination, request.url))
  }

  const isAdminRoute = ADMIN_ROUTES.some((route) =>
    matchesRoute(pathname, route)
  )
  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL(homeRouteFor(role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Every page request; never static assets, images, or Next internals.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
