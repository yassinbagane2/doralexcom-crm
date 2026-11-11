import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { invoice, lease, payment, property, user } from "@workspace/db/schema"
import { and, eq, type SQL } from "drizzle-orm"
import { z } from "zod"

import { formatInvoiceNumber } from "../invoice"
import { RENT_CURRENCIES } from "../property"
import { readCustomerMetadata } from "./customer"
import { findLandlord, landlordSchema } from "./landlord"

/** What a receipt for one payment prints. */
export const receiptSchema = z.object({
  number: z.string(),
  amount: z.number(),
  paidOn: z.string(),
  note: z.string().nullable(),
  currency: z.enum(RENT_CURRENCIES),
  invoice: z.object({
    number: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    total: z.number(),
  }),
  landlord: landlordSchema,
  customer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    address: z.string().nullable(),
  }),
  property: z.object({ name: z.string(), address: z.string() }),
})

/**
 * The receipt for payment `id`, as long as `scope` (the business's, or the
 * customer's own leases) lets the reader see it: who paid whom, for which
 * invoice, and where future rent goes.
 */
export async function loadReceipt(
  id: string,
  scope: SQL | undefined
): Promise<z.output<typeof receiptSchema>> {
  const [row] = await db
    .select({ payment, invoice, lease, property, customer: user })
    .from(payment)
    .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
    .innerJoin(lease, eq(lease.id, payment.leaseId))
    .innerJoin(property, eq(property.id, lease.propertyId))
    .innerJoin(user, eq(user.id, lease.customerId))
    .where(and(eq(payment.id, id), scope))
    .limit(1)

  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Payment not found.",
      data: { code: "PAYMENT_NOT_FOUND" },
    })
  }

  return {
    // Stable and unique enough to quote: the year, then the payment's id.
    number: `${row.payment.paidOn.slice(0, 4)}-${row.payment.id.slice(0, 8).toUpperCase()}`,
    amount: row.payment.amount,
    paidOn: row.payment.paidOn,
    note: row.payment.note,
    currency: row.lease.currency,
    invoice: {
      number: formatInvoiceNumber(row.invoice.number),
      periodStart: row.invoice.periodStart,
      periodEnd: row.invoice.periodEnd,
      total: row.invoice.total,
    },
    landlord: await findLandlord(row.lease.organizationId),
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      email: row.customer.email,
      address: readCustomerMetadata(row.customer.metadata).address,
    },
    property: { name: row.property.name, address: row.property.address },
  }
}
