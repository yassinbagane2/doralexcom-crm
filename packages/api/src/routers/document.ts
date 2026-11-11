import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import {
  customerDocument,
  lease,
  organization,
  user,
} from "@workspace/db/schema"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o, publicProcedure } from "../index"
import {
  DOCUMENT_FILE_TYPES,
  DOCUMENT_KINDS,
  DOCUMENT_LIMITS,
  documentContentSchema,
  isDocumentFileType,
  SIGNATURE_STATUSES,
} from "../contract"
import { findCustomer } from "../lib/customer"
import { documentNotFound, documentProperty } from "../lib/document"
import { verifyPrintToken } from "../lib/signing/print-token"
import { signedContent, signingRecordSchema } from "../lib/signing/record"
import { discardSignedPdf, readSignedPdf } from "../lib/signing/signed-pdf"
import {
  assertEditable,
  sendForSignature,
  withdrawSignatureRequest,
} from "../lib/signing/workflow"
import {
  discardDocumentContent,
  documentStorage,
  saveContractContent,
} from "../lib/storage"
import { assertContentSize, contractName } from "./contract"

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

/** One of the business's contracts, or not found. */
async function findContract(organizationId: string, id: string) {
  const [found] = await db
    .select()
    .from(customerDocument)
    .where(
      and(
        ownDocument(organizationId, id),
        eq(customerDocument.kind, "contract")
      )
    )
    .limit(1)
  if (!found) throw documentNotFound()
  return found
}

/**
 * Files kept about a customer (a signed lease, an ID scan…) and the contracts
 * generated for their leases. Scoped to `context.organizationId` like every
 * business procedure. Customers only see the contracts sent to them for
 * signature (see the portal router).
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
          signatureStatus: z.enum(SIGNATURE_STATUSES).nullable(),
          sentAt: z.date().nullable(),
          completedAt: z.date().nullable(),
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
          signatureStatus: customerDocument.signatureStatus,
          sentAt: customerDocument.sentAt,
          completedAt: customerDocument.completedAt,
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

  /**
   * A contract and, once sent for signature, the signatures it has (filled
   * into its fields) and its audit trail.
   */
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
        signing: signingRecordSchema.nullable(),
      })
    )
    .handler(async ({ input, context }) => {
      const found = await findContract(context.organizationId, input.id)
      const { content, signing } = await signedContent(found)
      return {
        id: found.id,
        name: found.name,
        customerId: found.customerId,
        leaseId: found.leaseId,
        content,
        updatedAt: found.updatedAt,
        signing,
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
          signatureStatus: customerDocument.signatureStatus,
        })
        .from(customerDocument)
        .where(where)
        .limit(1)

      if (!found) throw documentNotFound()
      assertEditable(found)
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
      if (deleted.kind === "contract") await discardSignedPdf(deleted)
      return { success: true }
    }),

  /**
   * Signs the contract with the business's signature and asks the customer
   * to sign it too. The contract can't be edited from then on.
   */
  sendForSignature: businessProcedure
    .route({
      method: "POST",
      path: "/contracts/{id}/send",
      tags: ["documents"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const found = await findContract(context.organizationId, input.id)
      await sendForSignature(found, context.session.user, context.headers)
      return { success: true }
    }),

  /** Takes back a contract the customer hasn't signed yet, to edit it. */
  withdrawSignature: businessProcedure
    .route({
      method: "POST",
      path: "/contracts/{id}/withdraw",
      tags: ["documents"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const found = await findContract(context.organizationId, input.id)
      await withdrawSignatureRequest(
        found,
        context.session.user,
        context.headers
      )
      return { success: true }
    }),

  /**
   * What the signed PDF prints, for the web app's print page that the API's
   * headless Chrome opens. No session there: the token, minted by the API
   * for this one document and valid a few minutes, is the permission.
   */
  printable: publicProcedure
    .route({
      method: "GET",
      path: "/contracts/{id}/printable",
      tags: ["documents"],
    })
    .input(z.object({ id: z.uuid(), token: z.string().max(200) }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        landlord: z.string(),
        customer: z.object({ name: z.string(), email: z.string() }),
        property: z.string().nullable(),
        content: documentContentSchema,
        signing: signingRecordSchema,
      })
    )
    .handler(async ({ input }) => {
      if (!verifyPrintToken(input.id, input.token)) throw documentNotFound()
      const [found] = await db
        .select({
          document: customerDocument,
          landlord: organization.name,
          customer: { name: user.name, email: user.email },
        })
        .from(customerDocument)
        .innerJoin(
          organization,
          eq(organization.id, customerDocument.organizationId)
        )
        .innerJoin(user, eq(user.id, customerDocument.customerId))
        .where(
          and(
            eq(customerDocument.id, input.id),
            isNotNull(customerDocument.signatureStatus)
          )
        )
      if (!found) throw documentNotFound()

      const [{ content, signing }, place] = await Promise.all([
        signedContent(found.document),
        documentProperty(found.document),
      ])
      if (!signing) throw documentNotFound()
      return {
        id: found.document.id,
        name: found.document.name,
        landlord: found.landlord,
        customer: found.customer,
        property: place?.name ?? null,
        content,
        signing,
      }
    }),

  /**
   * A contract sent for signature, as the PDF kept in R2: signed by the
   * business, and by the customer too once they have.
   */
  pdf: businessProcedure
    .route({ method: "GET", path: "/contracts/{id}/pdf", tags: ["documents"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(async ({ input, context }) => {
      const found = await findContract(context.organizationId, input.id)
      const pdf = found.signatureStatus ? await readSignedPdf(found) : null
      if (!pdf) throw documentNotFound()
      return new File([new Uint8Array(pdf)], `${found.name}.pdf`, {
        type: "application/pdf",
      })
    }),
})
