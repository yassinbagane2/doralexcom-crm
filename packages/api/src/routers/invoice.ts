import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { invoice, lease, payment, paymentProof } from "@workspace/db/schema"
import { and, eq, exists, notExists, sql } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { PAYMENT_PROOF_LIMITS } from "../invoice"
import { CUSTOMER_LIMITS } from "../lease"
import { invoiceNotFound } from "../lib/payment"
import {
  confirmPaymentProof,
  discardProofFiles,
  proofOwners,
  readProofFile,
  recordPaymentWithProof,
  rejectPaymentProof,
} from "../lib/payment-proof"
import { loadReceipt, receiptSchema } from "../lib/receipt"
import { PROPERTY_LIMITS } from "../property"

const paymentsOn = (invoiceId: typeof invoice.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .where(eq(payment.invoiceId, invoiceId))

const pendingProofsOn = (invoiceId: typeof invoice.id) =>
  db
    .select({ one: sql`1` })
    .from(paymentProof)
    .where(
      and(
        eq(paymentProof.invoiceId, invoiceId),
        eq(paymentProof.status, "pending")
      )
    )

/** What a payment says was paid, as the business and its customer enter it. */
export const paymentInput = z.object({
  amount: z.number().finite().positive().max(PROPERTY_LIMITS.rent),
  paidOn: z.iso.date(),
  note: z
    .string()
    .trim()
    .max(CUSTOMER_LIMITS.paymentNote)
    .transform((value) => value || null),
})

/**
 * The invoices issued on a business's leases (see lib/invoice.ts for how they
 * are issued), and the payments that settle them. Every payment is made
 * against one invoice; an invoice can be paid in several parts. Customers
 * send proof of what they paid (see lib/payment-proof.ts), reviewed here.
 * Scoped to `context.organizationId` like every business procedure.
 */
export const invoiceRouter = o.prefix("/invoices").router({
  /** Money the business received, with the proof of it when it has one. */
  addPayment: businessProcedure
    .route({
      method: "POST",
      path: "/{invoiceId}/payments",
      tags: ["invoices"],
    })
    .input(
      paymentInput.extend({ invoiceId: z.uuid(), proof: z.file().optional() })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { proof, ...values } = input
      const id = await recordPaymentWithProof(
        {
          organizationId: context.organizationId,
          userId: context.session.user.id,
        },
        { ...values, file: proof }
      )
      return { id }
    }),

  removePayment: businessProcedure
    .route({ method: "DELETE", path: "/payments/{id}", tags: ["invoices"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      // Its proof goes with it (the row by cascade, the file after).
      const proofs = await proofOwners(
        db,
        and(
          eq(paymentProof.paymentId, input.id),
          eq(paymentProof.organizationId, context.organizationId)
        )!
      )
      const deleted = await db
        .delete(payment)
        .where(
          and(
            eq(payment.id, input.id),
            exists(
              db
                .select({ one: sql`1` })
                .from(lease)
                .where(
                  and(
                    eq(lease.id, payment.leaseId),
                    eq(lease.organizationId, context.organizationId)
                  )
                )
            )
          )
        )
        .returning({ id: payment.id })

      if (deleted.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Payment not found." })
      }
      await discardProofFiles(proofs)
      return { success: true }
    }),

  /**
   * Cancels an invoice nothing has been paid on, and no proof of payment is
   * waiting on. It stays on record.
   */
  void: businessProcedure
    .route({ method: "POST", path: "/{id}/void", tags: ["invoices"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const voided = await db
        .update(invoice)
        .set({ voidedAt: new Date() })
        .where(
          and(
            eq(invoice.id, input.id),
            eq(invoice.organizationId, context.organizationId),
            notExists(paymentsOn(invoice.id)),
            notExists(pendingProofsOn(invoice.id))
          )
        )
        .returning({ id: invoice.id })
      if (voided.length > 0) return { success: true }

      const [found] = await db
        .select({ id: invoice.id })
        .from(invoice)
        .where(
          and(
            eq(invoice.id, input.id),
            eq(invoice.organizationId, context.organizationId)
          )
        )
      if (!found) throw invoiceNotFound()
      const [paid] = await db
        .select({ id: payment.id })
        .from(payment)
        .where(eq(payment.invoiceId, found.id))
        .limit(1)
      if (paid) {
        throw new ORPCError("CONFLICT", {
          message: "Payments are recorded on this invoice. Remove them first.",
          data: { code: "INVOICE_HAS_PAYMENTS" },
        })
      }
      throw new ORPCError("CONFLICT", {
        message:
          "The customer sent proof of payment for this invoice. Confirm or reject it first.",
        data: { code: "INVOICE_HAS_PENDING_PROOF" },
      })
    }),

  /** Accepts the customer's proof of payment: the payment is recorded. */
  confirmProof: businessProcedure
    .route({
      method: "POST",
      path: "/proofs/{id}/confirm",
      tags: ["invoices"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      await confirmPaymentProof(
        {
          organizationId: context.organizationId,
          userId: context.session.user.id,
        },
        input.id
      )
      return { success: true }
    }),

  /** Turns the customer's proof of payment down, saying why. */
  rejectProof: businessProcedure
    .route({
      method: "POST",
      path: "/proofs/{id}/reject",
      tags: ["invoices"],
    })
    .input(
      z.object({
        id: z.uuid(),
        reason: z
          .string()
          .trim()
          .min(1)
          .max(PAYMENT_PROOF_LIMITS.rejectionReason),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      await rejectPaymentProof(
        {
          organizationId: context.organizationId,
          userId: context.session.user.id,
        },
        input.id,
        input.reason
      )
      return { success: true }
    }),

  proofFile: businessProcedure
    .route({ method: "GET", path: "/proofs/{id}/file", tags: ["invoices"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(({ input, context }) =>
      readProofFile(input.id, eq(lease.organizationId, context.organizationId))
    ),

  receipt: businessProcedure
    .route({
      method: "GET",
      path: "/payments/{id}/receipt",
      tags: ["invoices"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(receiptSchema)
    .handler(({ input, context }) =>
      loadReceipt(input.id, eq(lease.organizationId, context.organizationId))
    ),
})
