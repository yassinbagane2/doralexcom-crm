import { ORPCError, os } from "@orpc/server"
import { STAFF_MEMBER_ROLES } from "@workspace/auth/organization"
import { getUserRole } from "@workspace/auth/roles"
import { db } from "@workspace/db"
import { member } from "@workspace/db/schema"
import { and, asc, eq, inArray } from "drizzle-orm"

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
 * Business accounts, scoped to the organization they work in: the one they
 * own, or the one whose owner invited them as a collaborator. Every business
 * procedure works inside `context.organizationId` and nowhere else;
 * `context.memberRole` says which of the two they are.
 */
const requireBusiness = o.middleware(async ({ context, next }) => {
  const session = context.session
  if (!session || getUserRole(session.user.role) !== "business") {
    throw new ORPCError("FORBIDDEN")
  }

  const ownership = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      inArray(member.role, STAFF_MEMBER_ROLES),
      session.session.activeOrganizationId
        ? eq(member.organizationId, session.session.activeOrganizationId)
        : undefined
    ),
    orderBy: asc(member.createdAt),
    columns: { organizationId: true, role: true },
  })

  if (!ownership) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Set up your organization first.",
      data: { code: "NO_ORGANIZATION" },
    })
  }

  return next({
    context: {
      organizationId: ownership.organizationId,
      memberRole: ownership.role as (typeof STAFF_MEMBER_ROLES)[number],
    },
  })
})

export const businessProcedure = protectedProcedure.use(requireBusiness)

/**
 * The organization's owner only: its settings, and who else has access to
 * it. Collaborators work on the records but can't change these.
 */
export const ownerProcedure = businessProcedure.use(
  async ({ context, next }) => {
    if (context.memberRole !== "owner") {
      throw new ORPCError("FORBIDDEN", {
        message: "Only the owner of the business can do this.",
        data: { code: "OWNER_ONLY" },
      })
    }
    return next()
  }
)
