/*
 * Who an account is. Shared by the server's admin plugin and the web client,
 * so keep this file free of server imports: it ends up in client bundles.
 *
 *   admin    — runs the platform; the only role that can create businesses.
 *   business — owns an organization; creates `user` accounts inside it.
 *   user     — belongs to a business's organization; creates nobody.
 */

import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export const USER_ROLES = ["admin", "business", "user"] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Accounts made without an explicit role. */
export const DEFAULT_USER_ROLE: UserRole = "user"

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

/**
 * Better Auth stores the role as free text (comma-separated when several).
 * Anything unknown or missing reads as the least privileged role.
 */
export function getUserRole(role: string | null | undefined): UserRole {
  const roles = (role ?? "").split(",").map((r) => r.trim())
  if (roles.includes("admin")) return "admin"
  if (roles.includes("business")) return "business"
  return DEFAULT_USER_ROLE
}

export const ac = createAccessControl(defaultStatements)

/**
 * Admin plugin permissions per role. Only admins get any: a business manages
 * its own users through the API's business router, which scopes every call to
 * its organization instead of letting it list or edit everyone.
 */
export const roles = {
  admin: ac.newRole(adminAc.statements),
  business: ac.newRole({ user: [], session: [] }),
  user: ac.newRole({ user: [], session: [] }),
}
