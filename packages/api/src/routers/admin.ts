import { db } from "@workspace/db"
import { member, organization, user } from "@workspace/db/schema"
import { and, count, desc, eq, inArray, ne, or, isNull, sql } from "drizzle-orm"
import { z } from "zod"

import { adminProcedure, o } from "../index"

const DAY_MS = 24 * 60 * 60 * 1000

/** Everyone the platform serves: businesses and their users, not admins. */
const isCustomer = or(isNull(user.role), ne(user.role, "admin"))

/** `count(*) FILTER (WHERE …)`, so every number comes from one scan. */
function countWhere(condition: ReturnType<typeof sql>) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number)
}

export const adminRouter = o.prefix("/admin").router({
  /** The dashboard's home page: headline numbers and the latest sign-ups. */
  overview: adminProcedure
    .route({ method: "GET", path: "/overview", tags: ["admin"] })
    .output(
      z.object({
        total: z.number(),
        businesses: z.number(),
        users: z.number(),
        newThisWeek: z.number(),
        newThisMonth: z.number(),
        verified: z.number(),
        twoFactor: z.number(),
        banned: z.number(),
        recent: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            role: z.string().nullable(),
            banned: z.boolean(),
            createdAt: z.date(),
          })
        ),
      })
    )
    .handler(async () => {
      const now = Date.now()
      const weekAgo = new Date(now - 7 * DAY_MS)
      const monthAgo = new Date(now - 30 * DAY_MS)

      const [[totals], recent] = await Promise.all([
        db
          .select({
            total: count(),
            businesses: countWhere(sql`${user.role} = 'business'`),
            users: countWhere(sql`coalesce(${user.role}, 'user') = 'user'`),
            newThisWeek: countWhere(sql`${user.createdAt} >= ${weekAgo}`),
            newThisMonth: countWhere(sql`${user.createdAt} >= ${monthAgo}`),
            verified: countWhere(sql`${user.emailVerified}`),
            twoFactor: countWhere(sql`${user.twoFactorEnabled} is true`),
            banned: countWhere(sql`${user.banned} is true`),
          })
          .from(user)
          .where(isCustomer),
        db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            banned: user.banned,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(isCustomer)
          .orderBy(desc(user.createdAt))
          .limit(8),
      ])

      return {
        total: totals?.total ?? 0,
        businesses: totals?.businesses ?? 0,
        users: totals?.users ?? 0,
        newThisWeek: totals?.newThisWeek ?? 0,
        newThisMonth: totals?.newThisMonth ?? 0,
        verified: totals?.verified ?? 0,
        twoFactor: totals?.twoFactor ?? 0,
        banned: totals?.banned ?? 0,
        recent: recent.map((row) => ({ ...row, banned: Boolean(row.banned) })),
      }
    }),

  /**
   * Where an account sits: the organization a business owns (and how many
   * users it has), or the business a user belongs to.
   */
  organizations: adminProcedure
    .route({
      method: "GET",
      path: "/users/{userId}/organizations",
      tags: ["admin"],
    })
    .input(z.object({ userId: z.string() }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          memberRole: z.string(),
          userCount: z.number(),
          owner: z
            .object({ id: z.string(), name: z.string(), email: z.string() })
            .nullable(),
        })
      )
    )
    .handler(async ({ input }) => {
      const memberships = await db
        .select({
          id: organization.id,
          name: organization.name,
          type: organization.type,
          memberRole: member.role,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(eq(member.userId, input.userId))

      if (memberships.length === 0) return []

      const ids = memberships.map((m) => m.id)

      const [counts, owners] = await Promise.all([
        db
          .select({ organizationId: member.organizationId, value: count() })
          .from(member)
          .where(
            and(inArray(member.organizationId, ids), ne(member.role, "owner"))
          )
          .groupBy(member.organizationId),
        db
          .select({
            organizationId: member.organizationId,
            id: user.id,
            name: user.name,
            email: user.email,
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(
            and(inArray(member.organizationId, ids), eq(member.role, "owner"))
          ),
      ])

      return memberships.map((m) => {
        const owner = owners.find((o) => o.organizationId === m.id)
        return {
          ...m,
          userCount: counts.find((c) => c.organizationId === m.id)?.value ?? 0,
          owner: owner
            ? { id: owner.id, name: owner.name, email: owner.email }
            : null,
        }
      })
    }),
})
