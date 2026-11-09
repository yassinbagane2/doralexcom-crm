import { ORPCError } from "@orpc/server"
import { auth } from "@workspace/auth"
import { newPasswordSchema } from "@workspace/auth/password"
import { db } from "@workspace/db"
import { member, session, user } from "@workspace/db/schema"
import { and, desc, eq, max, ne } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { callAuth } from "../lib/auth-error"

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
            ne(member.userId, context.session.user.id)
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
    .handler(async ({ input, context }) => {
      // No request headers: the trusted server is creating the account, so the
      // admin plugin's own permission check (admins only) doesn't apply. The
      // role is fixed here, never taken from the caller.
      const { user: created } = await callAuth(() =>
        auth.api.createUser({
          body: {
            name: input.name,
            email: input.email,
            password: input.password,
            role: "user",
          },
        })
      )

      try {
        await callAuth(() =>
          auth.api.addMember({
            body: {
              userId: created.id,
              organizationId: context.organizationId,
              role: "member",
            },
          })
        )
      } catch (error) {
        // An account outside any business would be stranded: undo it.
        await db.delete(user).where(eq(user.id, created.id))
        throw error
      }

      return { id: created.id }
    }),

  removeUser: businessProcedure
    .route({ method: "DELETE", path: "/users/{userId}", tags: ["business"] })
    .input(z.object({ userId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const target = await db
        .select({ role: user.role })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, context.organizationId),
            eq(member.userId, input.userId)
          )
        )
        .limit(1)

      // Only accounts this business created: never itself, never another
      // business or an admin that happens to share the organization.
      if (!target[0] || target[0].role !== "user") {
        throw new ORPCError("NOT_FOUND", { message: "User not found." })
      }

      // Sessions, credentials and the membership go with it (FK cascade).
      await db.delete(user).where(eq(user.id, input.userId))

      return { success: true }
    }),
})
