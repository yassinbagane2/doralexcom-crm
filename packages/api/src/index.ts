import { ORPCError, os } from "@orpc/server"
import { getUserRole } from "@workspace/auth/roles"
import { db } from "@workspace/db"
import { member } from "@workspace/db/schema"
import { and, asc, eq } from "drizzle-orm"

import type { Context } from "./context"

export const o = os.$context<Context>()

export const publicProcedure = o

const requireSession = o.middleware(async ({ context, next }) => {
  if (!context.session) {
    throw new ORPCError("UNAUTHORIZED")
  }

  // Narrows `session` to non-null for every procedure built on this one.
  return next({ context: { session: context.session } })
})

export const protectedProcedure = publicProcedure.use(requireSession)

/** Platform admins only. */
const requireAdmin = o.middleware(async ({ context, next }) => {
  if (getUserRole(context.session?.user.role) !== "admin") {
    throw new ORPCError("FORBIDDEN")
  }

  return next()
})

export const adminProcedure = protectedProcedure.use(requireAdmin)

/**
 * Business accounts, scoped to the organization they own. Every business
 * procedure works inside `context.organizationId` and nowhere else.
 */
const requireBusiness = o.middleware(async ({ context, next }) => {
  const session = context.session
  if (!session || getUserRole(session.user.role) !== "business") {
    throw new ORPCError("FORBIDDEN")
  }

  const ownership = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.role, "owner"),
      session.session.activeOrganizationId
        ? eq(member.organizationId, session.session.activeOrganizationId)
        : undefined
    ),
    orderBy: asc(member.createdAt),
    columns: { organizationId: true },
  })

  if (!ownership) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Set up your organization first.",
      data: { code: "NO_ORGANIZATION" },
    })
  }

  return next({ context: { organizationId: ownership.organizationId } })
})

export const businessProcedure = protectedProcedure.use(requireBusiness)
