import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { template, lease, property, user } from "@workspace/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import {
  CONTRACT_LIMITS,
  documentContentSchema,
  type DocumentContent,
} from "../contract"
import { buildMergeData, mergeDataSchema } from "../lib/merge-data"

export const contractName = z.string().trim().min(1).max(CONTRACT_LIMITS.name)

/** Refuses content too large to store, images and all. */
export function assertContentSize(content: DocumentContent) {
  if (JSON.stringify(content).length > CONTRACT_LIMITS.contentBytes) {
    throw new ORPCError("PAYLOAD_TOO_LARGE", {
      message: "The document is too large to save. Try smaller images.",
      data: { code: "CONTENT_TOO_LARGE" },
    })
  }
}

function templateNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Contract template not found.",
    data: { code: "TEMPLATE_NOT_FOUND" },
  })
}

const templateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const ownTemplate = (organizationId: string, id: string) =>
  and(eq(template.id, id), eq(template.organizationId, organizationId))

/**
 * The contract templates a business writes, and the details a lease fills
 * them in with. Scoped to `context.organizationId` like every business
 * procedure.
 */
export const contractRouter = o.prefix("/contracts").router({
  listTemplates: businessProcedure
    .route({ method: "GET", path: "/templates", tags: ["contracts"] })
    .output(z.array(templateSummarySchema))
    .handler(({ context }) =>
      db
        .select({
          id: template.id,
          name: template.name,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        })
        .from(template)
        .where(eq(template.organizationId, context.organizationId))
        .orderBy(desc(template.updatedAt))
    ),

  getTemplate: businessProcedure
    .route({ method: "GET", path: "/templates/{id}", tags: ["contracts"] })
    .input(z.object({ id: z.uuid() }))
    .output(templateSummarySchema.extend({ content: documentContentSchema }))
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select()
        .from(template)
        .where(ownTemplate(context.organizationId, input.id))
        .limit(1)

      if (!found) throw templateNotFound()
      return {
        id: found.id,
        name: found.name,
        content: documentContentSchema.parse(found.content),
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      }
    }),

  createTemplate: businessProcedure
    .route({ method: "POST", path: "/templates", tags: ["contracts"] })
    .input(z.object({ name: contractName, content: documentContentSchema }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      assertContentSize(input.content)
      const [created] = await db
        .insert(template)
        .values({ ...input, organizationId: context.organizationId })
        .returning({ id: template.id })

      return { id: created!.id }
    }),

  updateTemplate: businessProcedure
    .route({ method: "PUT", path: "/templates/{id}", tags: ["contracts"] })
    .input(
      z.object({
        id: z.uuid(),
        name: contractName,
        content: documentContentSchema,
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      assertContentSize(input.content)
      const updated = await db
        .update(template)
        .set({ name: input.name, content: input.content })
        .where(ownTemplate(context.organizationId, input.id))
        .returning({ id: template.id })

      if (updated.length === 0) throw templateNotFound()
      return { id: input.id }
    }),

  /** Contracts already generated from it keep their own copy of the text. */
  removeTemplate: businessProcedure
    .route({ method: "DELETE", path: "/templates/{id}", tags: ["contracts"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(template)
        .where(ownTemplate(context.organizationId, input.id))
        .returning({ id: template.id })

      if (deleted.length === 0) throw templateNotFound()
      return { success: true }
    }),

  /** What a saved lease's contract can mention (see `mergeDataSchema`). */
  mergeData: businessProcedure
    .route({ method: "GET", path: "/leases/{leaseId}", tags: ["contracts"] })
    .input(z.object({ leaseId: z.uuid() }))
    .output(mergeDataSchema)
    .handler(async ({ input, context }) => {
      const [row] = await db
        .select({ lease, property, customer: user })
        .from(lease)
        .innerJoin(property, eq(property.id, lease.propertyId))
        .innerJoin(user, eq(user.id, lease.customerId))
        .where(
          and(
            eq(lease.id, input.leaseId),
            eq(lease.organizationId, context.organizationId)
          )
        )
        .limit(1)

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Lease not found.",
          data: { code: "LEASE_NOT_FOUND" },
        })
      }

      return buildMergeData(context.organizationId, row)
    }),
})
