import { ORPCError, os } from "@orpc/server"

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
