import { ORPCError } from "@orpc/server"
import type { db } from "@workspace/db"
import { invoice, lease, payment } from "@workspace/db/schema"
import { eq, sum, type SQL } from "drizzle-orm"

import { invoiceRemaining } from "../invoice"

/*
 * Money received against an invoice, however it is recorded: by the
 * business directly, or by confirming the customer's proof of payment. Every
 * payment goes through `lockInvoice` then `recordPayment`, in one
 * transaction, so two payments at once can't both fit what was left.
 */

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface PaymentValues {
  amount: number
  paidOn: string
  note: string | null
}

export function invoiceNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Invoice not found.",
    data: { code: "INVOICE_NOT_FOUND" },
  })
}

/**
 * Locks the invoice `where` selects (on `invoice` and its `lease`) until the
 * transaction ends, and says what is left to pay on it. A voided invoice
 * takes no payment.
 */
export async function lockInvoice(tx: Transaction, where: SQL | undefined) {
  const [found] = await tx
    .select({
      id: invoice.id,
      organizationId: invoice.organizationId,
      leaseId: invoice.leaseId,
      customerId: lease.customerId,
      total: invoice.total,
      voidedAt: invoice.voidedAt,
    })
    .from(invoice)
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .where(where)
    .for("update", { of: invoice })
  if (!found) throw invoiceNotFound()
  if (found.voidedAt) {
    throw new ORPCError("CONFLICT", {
      message: "This invoice was voided.",
      data: { code: "INVOICE_VOID" },
    })
  }

  const [received] = await tx
    .select({ total: sum(payment.amount) })
    .from(payment)
    .where(eq(payment.invoiceId, found.id))
  return {
    ...found,
    remaining: invoiceRemaining({
      ...found,
      paid: Number(received?.total ?? 0),
    }),
  }
}

export type LockedInvoice = Awaited<ReturnType<typeof lockInvoice>>

/** A payment of `amount` must fit in what is left to pay. */
export function assertPaymentFits(locked: LockedInvoice, amount: number) {
  if (amount > locked.remaining + 0.001) {
    throw new ORPCError("BAD_REQUEST", {
      message: "The payment is more than what's left to pay on this invoice.",
      data: { code: "PAYMENT_EXCEEDS_INVOICE", remaining: locked.remaining },
    })
  }
}

/** Records a payment against an invoice locked by `lockInvoice`. */
export async function recordPayment(
  tx: Transaction,
  locked: LockedInvoice,
  values: PaymentValues
) {
  assertPaymentFits(locked, values.amount)
  const [created] = await tx
    .insert(payment)
    .values({ ...values, invoiceId: locked.id, leaseId: locked.leaseId })
    .returning({ id: payment.id })
  return created!.id
}
