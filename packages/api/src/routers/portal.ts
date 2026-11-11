import { db } from "@workspace/db"
import {
  customerDocument,
  lease,
  organization,
  property,
} from "@workspace/db/schema"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { z } from "zod"

import { o, protectedProcedure } from "../index"
import {
  documentContentSchema,
  SIGNATURE_STATUSES,
  signatureImageSchema,
  signerNameSchema,
} from "../contract"
import { documentNotFound, documentProperty } from "../lib/document"
import { invoiceSchema, loadInvoices } from "../lib/invoice"
import {
  cancelPaymentProof,
  readProofFile,
  submitPaymentProof,
} from "../lib/payment-proof"
import { loadReceipt, receiptSchema } from "../lib/receipt"
import { signedContent, signingRecordSchema } from "../lib/signing/record"
import { readSignedPdf } from "../lib/signing/signed-pdf"
import { recordViewed, signAsCustomer } from "../lib/signing/workflow"
import { paymentInput } from "./invoice"

/*
 * What a signed-in customer sees of their landlord's records: the invoices on
 * their leases and receipts for what they paid, and the contracts sent to
 * them for signature. Everything is scoped to their own account; nothing the
 * business keeps privately (drafts, files, other customers) reaches here.
 */

/** One of the customer's contracts that was sent to them for signature. */
async function findMyDocument(customerId: string, id: string) {
  const [found] = await db
    .select()
    .from(customerDocument)
    .where(
      and(
        eq(customerDocument.id, id),
        eq(customerDocument.customerId, customerId),
        eq(customerDocument.kind, "contract"),
        isNotNull(customerDocument.signatureStatus)
      )
    )
    .limit(1)
  if (!found) throw documentNotFound()
  return found
}

export const portalRouter = o.prefix("/portal").router({
  /** Every invoice on the customer's leases, newest first. */
  invoices: protectedProcedure
    .route({ method: "GET", path: "/invoices", tags: ["portal"] })
    .output(
      z.array(
        invoiceSchema.extend({ property: z.object({ name: z.string() }) })
      )
    )
    .handler(async ({ context }) => {
      const leases = await db
        .select({ id: lease.id, propertyName: property.name })
        .from(lease)
        .innerJoin(property, eq(property.id, lease.propertyId))
        .where(eq(lease.customerId, context.session.user.id))
      const names = new Map(leases.map((l) => [l.id, l.propertyName]))

      const invoices = await loadInvoices(leases.map((l) => l.id))
      return invoices.map((invoice) => ({
        ...invoice,
        property: { name: names.get(invoice.leaseId) ?? "" },
      }))
    }),

  /**
   * Proof the customer paid an invoice outside the app (a transfer
   * confirmation, a photo of a receipt), for their landlord to confirm.
   */
  submitPaymentProof: protectedProcedure
    .route({
      method: "POST",
      path: "/invoices/{invoiceId}/proofs",
      tags: ["portal"],
    })
    .input(paymentInput.extend({ invoiceId: z.uuid(), file: z.file() }))
    .output(z.object({ id: z.string() }))
    .handler(({ input, context }) =>
      submitPaymentProof(context.session.user.id, input)
    ),

  /** Takes back proof the landlord hasn't reviewed yet. */
  cancelPaymentProof: protectedProcedure
    .route({ method: "DELETE", path: "/proofs/{id}", tags: ["portal"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      await cancelPaymentProof(context.session.user.id, input.id)
      return { success: true }
    }),

  paymentProofFile: protectedProcedure
    .route({ method: "GET", path: "/proofs/{id}/file", tags: ["portal"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(({ input, context }) =>
      readProofFile(input.id, eq(lease.customerId, context.session.user.id))
    ),

  receipt: protectedProcedure
    .route({ method: "GET", path: "/receipts/{id}", tags: ["portal"] })
    .input(z.object({ id: z.uuid() }))
    .output(receiptSchema)
    .handler(({ input, context }) =>
      loadReceipt(input.id, eq(lease.customerId, context.session.user.id))
    ),

  /** Contracts sent to the customer: to sign, and signed. */
  documents: protectedProcedure
    .route({ method: "GET", path: "/documents", tags: ["portal"] })
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.enum(SIGNATURE_STATUSES),
          sentAt: z.date().nullable(),
          completedAt: z.date().nullable(),
          property: z.string().nullable(),
        })
      )
    )
    .handler(async ({ context }) => {
      const rows = await db
        .select({ document: customerDocument, property: property.name })
        .from(customerDocument)
        .leftJoin(lease, eq(lease.id, customerDocument.leaseId))
        .leftJoin(property, eq(property.id, lease.propertyId))
        .where(
          and(
            eq(customerDocument.customerId, context.session.user.id),
            eq(customerDocument.kind, "contract"),
            isNotNull(customerDocument.signatureStatus)
          )
        )
        .orderBy(desc(customerDocument.sentAt))

      return rows.map(({ document, property }) => ({
        id: document.id,
        name: document.name,
        status: document.signatureStatus!,
        sentAt: document.sentAt,
        completedAt: document.completedAt,
        property,
      }))
    }),

  /** A contract to read and sign. Opening it is noted in its audit trail. */
  document: protectedProcedure
    .route({ method: "GET", path: "/documents/{id}", tags: ["portal"] })
    .input(z.object({ id: z.uuid() }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        landlord: z.string(),
        property: z.string().nullable(),
        content: documentContentSchema,
        signing: signingRecordSchema,
      })
    )
    .handler(async ({ input, context }) => {
      const found = await findMyDocument(context.session.user.id, input.id)
      await recordViewed(found, context.session.user, context.headers)

      const [{ content, signing }, place, [business]] = await Promise.all([
        signedContent(found),
        documentProperty(found),
        db
          .select({ name: organization.name })
          .from(organization)
          .where(eq(organization.id, found.organizationId)),
      ])
      if (!signing) throw documentNotFound()

      return {
        id: found.id,
        name: found.name,
        landlord: business?.name ?? "",
        property: place?.name ?? null,
        content,
        signing,
      }
    }),

  sign: protectedProcedure
    .route({ method: "POST", path: "/documents/{id}/sign", tags: ["portal"] })
    .input(
      z.object({
        id: z.uuid(),
        name: signerNameSchema,
        image: signatureImageSchema,
        /** "I agree to sign electronically", ticked by the customer. */
        consent: z.literal(true),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const found = await findMyDocument(context.session.user.id, input.id)
      await signAsCustomer(
        found,
        context.session.user,
        { name: input.name, image: input.image },
        context.headers
      )
      return { success: true }
    }),

  /** The contract as the PDF kept in R2, signed so far. */
  pdf: protectedProcedure
    .route({ method: "GET", path: "/documents/{id}/pdf", tags: ["portal"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(async ({ input, context }) => {
      const found = await findMyDocument(context.session.user.id, input.id)
      const pdf = await readSignedPdf(found)
      if (!pdf) throw documentNotFound()
      return new File([new Uint8Array(pdf)], `${found.name}.pdf`, {
        type: "application/pdf",
      })
    }),
})
