import { db } from "@workspace/db"
import { organizationSignature } from "@workspace/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o, ownerProcedure } from "../index"
import { signatureImageSchema, signerNameSchema } from "../contract"

/**
 * The business's own signature (Settings → Signature): set by its owner,
 * applied to every contract the business sends for signature. Collaborators
 * can see it, since sending a contract signs with it on their behalf.
 */
export const signatureRouter = o.prefix("/signature").router({
  get: businessProcedure
    .route({ method: "GET", path: "/", tags: ["signature"] })
    .output(
      z
        .object({
          signerName: z.string(),
          image: z.string(),
          updatedAt: z.date(),
        })
        .nullable()
    )
    .handler(async ({ context }) => {
      const found = await db.query.organizationSignature.findFirst({
        where: eq(organizationSignature.organizationId, context.organizationId),
        columns: { signerName: true, image: true, updatedAt: true },
      })
      return found ?? null
    }),

  save: ownerProcedure
    .route({ method: "PUT", path: "/", tags: ["signature"] })
    .input(
      z.object({ signerName: signerNameSchema, image: signatureImageSchema })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const values = { ...input, updatedById: context.session.user.id }
      await db
        .insert(organizationSignature)
        .values({ ...values, organizationId: context.organizationId })
        .onConflictDoUpdate({
          target: organizationSignature.organizationId,
          set: { ...values, updatedAt: new Date() },
        })
      return { success: true }
    }),

  /** Contracts already sent keep the signature they were signed with. */
  remove: ownerProcedure
    .route({ method: "DELETE", path: "/", tags: ["signature"] })
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context }) => {
      await db
        .delete(organizationSignature)
        .where(eq(organizationSignature.organizationId, context.organizationId))
      return { success: true }
    }),
})
