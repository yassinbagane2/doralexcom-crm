import { db } from "@workspace/db"
import { account, passkey, session, user } from "@workspace/db/schema"
import { and, count, eq, gt } from "drizzle-orm"
import { z } from "zod"

import { o, protectedProcedure } from "../index"

export const userRouter = o.prefix("/user").router({
  /**
   * One round trip for the account page's overview card. Better Auth exposes
   * each of these separately; this is the place to aggregate app data too.
   */
  overview: protectedProcedure
    .route({ method: "GET", path: "/overview", tags: ["user"] })
    .output(
      z.object({
        memberSince: z.date(),
        hasPassword: z.boolean(),
        passkeyCount: z.number(),
        activeSessionCount: z.number(),
      })
    )
    .handler(async ({ context }) => {
      const userId = context.session.user.id

      const [profile, credential, passkeys, sessions] = await Promise.all([
        db.query.user.findFirst({
          where: eq(user.id, userId),
          columns: { createdAt: true },
        }),
        db.query.account.findFirst({
          where: and(
            eq(account.userId, userId),
            eq(account.providerId, "credential")
          ),
          columns: { id: true },
        }),
        db
          .select({ value: count() })
          .from(passkey)
          .where(eq(passkey.userId, userId)),
        db
          .select({ value: count() })
          .from(session)
          .where(
            and(eq(session.userId, userId), gt(session.expiresAt, new Date()))
          ),
      ])

      return {
        memberSince: profile?.createdAt ?? context.session.user.createdAt,
        hasPassword: Boolean(credential),
        passkeyCount: passkeys[0]?.value ?? 0,
        activeSessionCount: sessions[0]?.value ?? 0,
      }
    }),
})
