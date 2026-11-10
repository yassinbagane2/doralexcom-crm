import { newPasswordSchema } from "@workspace/auth/password"
import { db } from "@workspace/db"
import { member, session, user } from "@workspace/db/schema"
import { and, desc, eq, max, ne } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { createTenantAccount, deleteTenantAccount } from "../lib/tenant"

const businessUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  banned: z.boolean(),
  createdAt: z.date(),
  lastActiveAt: z.date().nullable(),
})

/**
 * A business manages the `user` accounts inside the organization it owns.
 * Nothing here reaches outside `context.organizationId`.
 */
export const businessRouter = o.prefix("/business").router({
  listUsers: businessProcedure
    .route({ method: "GET", path: "/users", tags: ["business"] })
    .output(z.array(businessUserSchema))
    .handler(async ({ context }) => {
      const lastActive = db
        .select({
          userId: session.userId,
          at: max(session.updatedAt).as("last_active_at"),
        })
        .from(session)
        .groupBy(session.userId)
        .as("last_active")

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          banned: user.banned,
          createdAt: user.createdAt,
          lastActiveAt: lastActive.at,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .leftJoin(lastActive, eq(lastActive.userId, user.id))
        .where(
          and(
            eq(member.organizationId, context.organizationId),
            ne(member.userId, context.session.user.id),
            // The owner and collaborators run the business; they aren't its users.
            eq(user.role, "user")
          )
        )
        .orderBy(desc(user.createdAt))

      return rows.map((row) => ({ ...row, banned: Boolean(row.banned) }))
    }),

  createUser: businessProcedure
    .route({ method: "POST", path: "/users", tags: ["business"] })
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        email: z.email().transform((email) => email.toLowerCase()),
        password: newPasswordSchema,
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => ({
      id: await createTenantAccount(context.organizationId, input),
    })),

  removeUser: businessProcedure
    .route({ method: "DELETE", path: "/users/{userId}", tags: ["business"] })
    .input(z.object({ userId: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      // Only accounts this business created: never itself, never another
      // business or an admin that happens to share the organization. A
      // tenant with recorded rent payments stays.
      await deleteTenantAccount(context.organizationId, input.userId)
      return { success: true }
    }),
})
