import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { lease, customerDocument } from "@workspace/db/schema"
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
import { findCustomer } from "../lib/customer"
import {
  discardDocumentContent,
  documentStorage,
  saveContractContent,
} from "../lib/storage"
import { assertContentSize, contractName } from "./contract"

function documentNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Document not found.",
    data: { code: "DOCUMENT_NOT_FOUND" },
  })
}

const ownDocument = (organizationId: string, id: string) =>
  and(
    eq(customerDocument.id, id),
    eq(customerDocument.organizationId, organizationId)
  )

/** The customer must be the business's, and the lease (if any) theirs. */
async function assertAttachable(
  organizationId: string,
  customerId: string,
  leaseId: string | null
) {
  await findCustomer(organizationId, customerId)
  if (!leaseId) return

  const [found] = await db
    .select({ id: lease.id })
    .from(lease)
    .where(
      and(
        eq(lease.id, leaseId),
        eq(lease.customerId, customerId),
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
 * Files kept about a customer (a signed lease, an ID scan…) and the contracts
 * generated for their leases. Scoped to `context.organizationId` like every
 * business procedure; customers don't see these.
 */
export const documentRouter = o.prefix("/documents").router({
  list: businessProcedure
    .route({
      method: "GET",
      path: "/customers/{customerId}",
      tags: ["documents"],
    })
    .input(z.object({ customerId: z.uuid() }))
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
      await findCustomer(context.organizationId, input.customerId)

      return db
        .select({
          id: customerDocument.id,
          kind: customerDocument.kind,
          name: customerDocument.name,
          leaseId: customerDocument.leaseId,
          mimeType: customerDocument.mimeType,
          size: customerDocument.size,
          createdAt: customerDocument.createdAt,
          updatedAt: customerDocument.updatedAt,
        })
        .from(customerDocument)
        .where(
          and(
            eq(customerDocument.customerId, input.customerId),
            eq(customerDocument.organizationId, context.organizationId)
          )
        )
        .orderBy(desc(customerDocument.createdAt))
    }),

  upload: businessProcedure
    .route({ method: "POST", path: "/files", tags: ["documents"] })
    .input(
      z.object({
        customerId: z.uuid(),
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
        input.customerId,
        input.leaseId
      )

      const name =
        file.name.trim().slice(0, DOCUMENT_LIMITS.name) ||
        withExtension("document", DOCUMENT_FILE_TYPES[file.type])

      // The file goes to R2 first: a row never points at missing content.
      const document = {
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        customerId: input.customerId,
        kind: "file" as const,
      }
      const { storage, key } = documentStorage(document)
      await storage.upload({
        key,
        body: new Uint8Array(await file.arrayBuffer()),
        contentType: file.type,
      })

      try {
        await db.insert(customerDocument).values({
          ...document,
          leaseId: input.leaseId,
          name,
          mimeType: file.type,
          size: file.size,
        })
      } catch (error) {
        await discardDocumentContent(document)
        throw error
      }

      return { id: document.id }
    }),

  download: businessProcedure
    .route({ method: "GET", path: "/files/{id}", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select()
        .from(customerDocument)
        .where(
          and(
            ownDocument(context.organizationId, input.id),
            eq(customerDocument.kind, "file")
          )
        )
        .limit(1)

      if (!found) throw documentNotFound()
      const { storage, key } = documentStorage(found)
      const bytes = await storage.getObjectBytes(key)
      if (!bytes) throw documentNotFound()
      return new File([new Uint8Array(bytes)], found.name, {
        type: found.mimeType ?? "application/octet-stream",
      })
    }),

  /** A contract filled in from a template, saved to edit and print later. */
  createContract: businessProcedure
    .route({ method: "POST", path: "/contracts", tags: ["documents"] })
    .input(
      z.object({
        customerId: z.uuid(),
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
        input.customerId,
        input.leaseId
      )

      const { content, ...values } = input
      const document = {
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        customerId: input.customerId,
      }
      await saveContractContent(document, content)

      try {
        await db
          .insert(customerDocument)
          .values({ ...values, ...document, kind: "contract" })
      } catch (error) {
        await discardDocumentContent({ ...document, kind: "contract" })
        throw error
      }

      return { id: document.id }
    }),

  getContract: businessProcedure
    .route({ method: "GET", path: "/contracts/{id}", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        customerId: z.string(),
        leaseId: z.string().nullable(),
        content: documentContentSchema,
        updatedAt: z.date(),
      })
    )
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select()
        .from(customerDocument)
        .where(
          and(
            ownDocument(context.organizationId, input.id),
            eq(customerDocument.kind, "contract")
          )
        )
        .limit(1)

      if (!found) throw documentNotFound()
      const { storage, key } = documentStorage(found)
      const content = await storage.getObjectText(key)
      if (content === null) throw documentNotFound()
      return {
        id: found.id,
        name: found.name,
        customerId: found.customerId,
        leaseId: found.leaseId,
        content: documentContentSchema.parse(JSON.parse(content)),
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
      const where = and(
        ownDocument(context.organizationId, input.id),
        eq(customerDocument.kind, "contract")
      )
      const [found] = await db
        .select({
          id: customerDocument.id,
          organizationId: customerDocument.organizationId,
          customerId: customerDocument.customerId,
        })
        .from(customerDocument)
        .where(where)
        .limit(1)

      if (!found) throw documentNotFound()
      await saveContractContent(found, input.content)
      // Also bumps updatedAt, which the content in R2 doesn't carry.
      await db.update(customerDocument).set({ name: input.name }).where(where)
      return { id: input.id }
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const [deleted] = await db
        .delete(customerDocument)
        .where(ownDocument(context.organizationId, input.id))
        .returning({
          id: customerDocument.id,
          organizationId: customerDocument.organizationId,
          customerId: customerDocument.customerId,
          kind: customerDocument.kind,
        })

      if (!deleted) throw documentNotFound()
      await discardDocumentContent(deleted)
      return { success: true }
    }),
})
