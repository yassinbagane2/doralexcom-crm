import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { lease, tenantDocument } from "@workspace/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import {
  DOCUMENT_FILE_TYPES,
  DOCUMENT_KINDS,
  DOCUMENT_LIMITS,
  documentContentSchema,
  isDocumentFileType,
} from "../contract"
import { findTenant } from "../lib/tenant"
import { assertContentSize, contractName } from "./contract"

function documentNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Document not found.",
    data: { code: "DOCUMENT_NOT_FOUND" },
  })
}

const ownDocument = (organizationId: string, id: string) =>
  and(
    eq(tenantDocument.id, id),
    eq(tenantDocument.organizationId, organizationId)
  )

/** The tenant must be the business's, and the lease (if any) theirs. */
async function assertAttachable(
  organizationId: string,
  tenantId: string,
  leaseId: string | null
) {
  await findTenant(organizationId, tenantId)
  if (!leaseId) return

  const [found] = await db
    .select({ id: lease.id })
    .from(lease)
    .where(
      and(
        eq(lease.id, leaseId),
        eq(lease.tenantId, tenantId),
        eq(lease.organizationId, organizationId)
      )
    )
    .limit(1)

  if (!found) {
    throw new ORPCError("NOT_FOUND", {
      message: "Lease not found.",
      data: { code: "LEASE_NOT_FOUND" },
    })
  }
}

/** "lease.pdf" stays as is; a name without the file's extension gets it. */
function withExtension(name: string, extension: string) {
  return name.toLowerCase().endsWith(`.${extension}`)
    ? name
    : `${name}.${extension}`
}

/**
 * Files kept about a tenant (a signed lease, an ID scan…) and the contracts
 * generated for their leases. Scoped to `context.organizationId` like every
 * business procedure; tenants don't see these.
 */
export const documentRouter = o.prefix("/documents").router({
  list: businessProcedure
    .route({ method: "GET", path: "/tenants/{tenantId}", tags: ["documents"] })
    .input(z.object({ tenantId: z.uuid() }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          kind: z.enum(DOCUMENT_KINDS),
          name: z.string(),
          leaseId: z.string().nullable(),
          mimeType: z.string().nullable(),
          size: z.number().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        })
      )
    )
    .handler(async ({ input, context }) => {
      await findTenant(context.organizationId, input.tenantId)

      return db
        .select({
          id: tenantDocument.id,
          kind: tenantDocument.kind,
          name: tenantDocument.name,
          leaseId: tenantDocument.leaseId,
          mimeType: tenantDocument.mimeType,
          size: tenantDocument.size,
          createdAt: tenantDocument.createdAt,
          updatedAt: tenantDocument.updatedAt,
        })
        .from(tenantDocument)
        .where(
          and(
            eq(tenantDocument.tenantId, input.tenantId),
            eq(tenantDocument.organizationId, context.organizationId)
          )
        )
        .orderBy(desc(tenantDocument.createdAt))
    }),

  upload: businessProcedure
    .route({ method: "POST", path: "/files", tags: ["documents"] })
    .input(
      z.object({
        tenantId: z.uuid(),
        leaseId: z.uuid().nullable(),
        file: z.file(),
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { file } = input
      if (!isDocumentFileType(file.type)) {
        throw new ORPCError("UNSUPPORTED_MEDIA_TYPE", {
          message: "This kind of file can't be attached.",
          data: { code: "DOCUMENT_TYPE" },
        })
      }
      if (file.size === 0 || file.size > DOCUMENT_LIMITS.fileBytes) {
        throw new ORPCError("PAYLOAD_TOO_LARGE", {
          message: "The file is empty or too large.",
          data: { code: "DOCUMENT_SIZE" },
        })
      }
      await assertAttachable(
        context.organizationId,
        input.tenantId,
        input.leaseId
      )

      const name =
        file.name.trim().slice(0, DOCUMENT_LIMITS.name) ||
        withExtension("document", DOCUMENT_FILE_TYPES[file.type])

      const [created] = await db
        .insert(tenantDocument)
        .values({
          organizationId: context.organizationId,
          tenantId: input.tenantId,
          leaseId: input.leaseId,
          kind: "file",
          name,
          mimeType: file.type,
          size: file.size,
          data: Buffer.from(await file.arrayBuffer()),
        })
        .returning({ id: tenantDocument.id })

      return { id: created!.id }
    }),

  download: businessProcedure
    .route({ method: "GET", path: "/files/{id}", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select({
          name: tenantDocument.name,
          mimeType: tenantDocument.mimeType,
          data: tenantDocument.data,
        })
        .from(tenantDocument)
        .where(
          and(
            ownDocument(context.organizationId, input.id),
            eq(tenantDocument.kind, "file")
          )
        )
        .limit(1)

      if (!found?.data) throw documentNotFound()
      return new File([new Uint8Array(found.data)], found.name, {
        type: found.mimeType ?? "application/octet-stream",
      })
    }),

  /** A contract filled in from a template, saved to edit and print later. */
  createContract: businessProcedure
    .route({ method: "POST", path: "/contracts", tags: ["documents"] })
    .input(
      z.object({
        tenantId: z.uuid(),
        leaseId: z.uuid().nullable(),
        name: contractName,
        content: documentContentSchema,
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      assertContentSize(input.content)
      await assertAttachable(
        context.organizationId,
        input.tenantId,
        input.leaseId
      )

      const [created] = await db
        .insert(tenantDocument)
        .values({
          ...input,
          organizationId: context.organizationId,
          kind: "contract",
        })
        .returning({ id: tenantDocument.id })

      return { id: created!.id }
    }),

  getContract: businessProcedure
    .route({ method: "GET", path: "/contracts/{id}", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        tenantId: z.string(),
        leaseId: z.string().nullable(),
        content: documentContentSchema,
        updatedAt: z.date(),
      })
    )
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select()
        .from(tenantDocument)
        .where(
          and(
            ownDocument(context.organizationId, input.id),
            eq(tenantDocument.kind, "contract")
          )
        )
        .limit(1)

      if (!found?.content) throw documentNotFound()
      return {
        id: found.id,
        name: found.name,
        tenantId: found.tenantId,
        leaseId: found.leaseId,
        content: documentContentSchema.parse(found.content),
        updatedAt: found.updatedAt,
      }
    }),

  updateContract: businessProcedure
    .route({ method: "PUT", path: "/contracts/{id}", tags: ["documents"] })
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
        .update(tenantDocument)
        .set({ name: input.name, content: input.content })
        .where(
          and(
            ownDocument(context.organizationId, input.id),
            eq(tenantDocument.kind, "contract")
          )
        )
        .returning({ id: tenantDocument.id })

      if (updated.length === 0) throw documentNotFound()
      return { id: input.id }
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(tenantDocument)
        .where(ownDocument(context.organizationId, input.id))
        .returning({ id: tenantDocument.id })

      if (deleted.length === 0) throw documentNotFound()
      return { success: true }
    }),
})
