import { db } from "@workspace/db"
import {
  invoice,
  lease,
  organization,
  payment,
  paymentProof,
  property,
  user,
} from "@workspace/db/schema"
import { and, asc, desc, eq, inArray, isNull, max, sql, sum } from "drizzle-orm"
import { z } from "zod"

import {
  INVOICE_LINE_KINDS,
  formatInvoiceNumber,
  invoiceDueDate,
  reconcileInvoices,
} from "../invoice"
import { localToday } from "../lease"
import { RENT_CURRENCIES } from "../property"
import { appLink } from "./links"
import { sendOrganizationEmail } from "./mailer"
import { paymentProofSchema, toPaymentProof } from "./payment-proof"

/*
 * Issuing invoices. Every lease is billed the same way, whoever asks: when
 * it is created, when its dates change, and on each rent date (the server's
 * daily 08:00 Romanian-time run, see `issueDueInvoices` and jobs.ts). Issuing is idempotent: one live
 * invoice per month of a lease, enforced by a unique index.
 */

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Transaction

type LeaseRow = typeof lease.$inferSelect

/** The invoices of one lease, with what has been paid on each. */
async function issuedInvoices(executor: Executor, leaseId: string) {
  const rows = await executor
    .select({
      id: invoice.id,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      total: invoice.total,
      voidedAt: invoice.voidedAt,
      lines: invoice.lines,
      paid: sum(payment.amount),
    })
    .from(invoice)
    .leftJoin(payment, eq(payment.invoiceId, invoice.id))
    .where(eq(invoice.leaseId, leaseId))
    .groupBy(invoice.id)

  return rows.map((row) => ({ ...row, paid: Number(row.paid ?? 0) }))
}

/**
 * Brings one lease's invoices in step with its dates, then issues every month
 * that has begun by `today` (and always the first, even before move-in).
 * Returns the ids of the invoices it issued. Runs inside `tx`, holding a lock
 * on the business's invoice numbers until it commits.
 */
export async function syncLeaseInvoices(
  tx: Transaction,
  current: LeaseRow,
  today = localToday()
): Promise<string[]> {
  const existing = await issuedInvoices(tx, current.id)

  const { toVoid, toIssue } = reconcileInvoices(existing, current, today)
  if (toVoid.length > 0) {
    await tx
      .update(invoice)
      .set({ voidedAt: new Date() })
      .where(and(inArray(invoice.id, toVoid), isNull(invoice.voidedAt)))
  }
  if (toIssue.length === 0) return []

  // Numbers count up per business: one issuer at a time.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`invoice:${current.organizationId}`}))`
  )
  const [{ last } = { last: 0 }] = await tx
    .select({ last: max(invoice.number) })
    .from(invoice)
    .where(eq(invoice.organizationId, current.organizationId))
  let number = Number(last ?? 0)

  const issued: string[] = []
  for (const { period, lines, total } of toIssue) {
    const [created] = await tx
      .insert(invoice)
      .values({
        organizationId: current.organizationId,
        leaseId: current.id,
        number: number + 1,
        periodStart: period.start,
        periodEnd: period.end,
        issuedOn: today,
        dueOn: invoiceDueDate(today),
        lines,
        total,
        currency: current.currency,
      })
      // Someone else issued this month a moment ago: nothing to do.
      .onConflictDoNothing()
      .returning({ id: invoice.id })
    if (created) {
      number += 1
      issued.push(created.id)
    }
  }
  return issued
}

/**
 * Tells customers about new invoices, by email from their landlord. Best
 * effort: an invoice exists whether or not the email went out.
 */
export async function notifyInvoicesIssued(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return

  const rows = await db
    .select({
      invoice,
      customer: { name: user.name, email: user.email },
      property: { name: property.name },
      business: { name: organization.name },
    })
    .from(invoice)
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .innerJoin(user, eq(user.id, lease.customerId))
    .innerJoin(property, eq(property.id, lease.propertyId))
    .innerJoin(organization, eq(organization.id, invoice.organizationId))
    .where(inArray(invoice.id, invoiceIds))

  for (const row of rows) {
    const money = new Intl.NumberFormat("en", {
      style: "currency",
      currency: row.invoice.currency,
    }).format(row.invoice.total)
    try {
      const link = await appLink(row.invoice.organizationId, "/my-home")
      await sendOrganizationEmail(row.invoice.organizationId, {
        to: row.customer.email,
        subject: `Invoice ${formatInvoiceNumber(row.invoice.number)} from ${row.business.name}: ${money} due ${row.invoice.dueOn}`,
        text: [
          `Hi ${row.customer.name},`,
          `${row.business.name} has issued invoice ${formatInvoiceNumber(row.invoice.number)} for ${row.property.name}, covering ${row.invoice.periodStart} to ${row.invoice.periodEnd}.`,
          `Amount due: ${money}, by ${row.invoice.dueOn}.`,
          `See your invoices and receipts:\n${link}`,
        ].join("\n\n"),
      })
    } catch (error) {
      console.error(`Could not email invoice ${row.invoice.id}`, error)
    }
  }
}

/**
 * Issues what has fallen due on every lease still billing: run by the
 * server every day at 08:00 Romanian time. Leases that ended (or were
 * terminated) more than a month ago have nothing left to bill.
 */
export async function issueDueInvoices(today = localToday()) {
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 40)
  const since = cutoff.toISOString().slice(0, 10)

  const leases = await db
    .select()
    .from(lease)
    .where(
      sql`(${lease.endDate} is null or ${lease.endDate} >= ${since} or (${lease.autoRenew} and ${lease.terminatedAt} is null))`
    )

  const issued: string[] = []
  for (const row of leases) {
    try {
      issued.push(
        ...(await db.transaction((tx) => syncLeaseInvoices(tx, row, today)))
      )
    } catch (error) {
      console.error(`Could not issue invoices for lease ${row.id}`, error)
    }
  }
  await notifyInvoicesIssued(issued)
  return issued.length
}

/** An invoice as the business and its customer read it, payments included. */
export const invoiceSchema = z.object({
  id: z.string(),
  leaseId: z.string(),
  number: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  issuedOn: z.string(),
  dueOn: z.string(),
  lines: z.array(
    z.object({ kind: z.enum(INVOICE_LINE_KINDS), amount: z.number() })
  ),
  total: z.number(),
  currency: z.enum(RENT_CURRENCIES),
  voidedAt: z.date().nullable(),
  paid: z.number(),
  payments: z.array(
    z.object({
      id: z.string(),
      amount: z.number(),
      paidOn: z.string(),
      note: z.string().nullable(),
      /** The file the payment was proven with, if any. */
      proof: z
        .object({ id: z.string(), fileName: z.string(), mimeType: z.string() })
        .nullable(),
    })
  ),
  /** Proofs of payment waiting for the business, or turned down; newest first. */
  proofs: z.array(paymentProofSchema),
})

/**
 * The invoices of these leases, newest month first, each with its payments
 * and the proofs of payment not (or not yet) confirmed.
 */
export async function loadInvoices(
  leaseIds: string[]
): Promise<z.output<typeof invoiceSchema>[]> {
  if (leaseIds.length === 0) return []

  const [invoices, payments, proofs] = await Promise.all([
    db
      .select()
      .from(invoice)
      .where(inArray(invoice.leaseId, leaseIds))
      .orderBy(desc(invoice.periodStart), desc(invoice.number)),
    db
      .select({ payment })
      .from(payment)
      .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
      .where(inArray(invoice.leaseId, leaseIds))
      .orderBy(asc(payment.paidOn), asc(payment.createdAt))
      .then((rows) => rows.map((row) => row.payment)),
    db
      .select({ proof: paymentProof })
      .from(paymentProof)
      .innerJoin(invoice, eq(invoice.id, paymentProof.invoiceId))
      .where(inArray(invoice.leaseId, leaseIds))
      .orderBy(desc(paymentProof.createdAt))
      .then((rows) => rows.map((row) => row.proof)),
  ])
  const proofOfPayment = new Map(
    proofs.flatMap((proof) =>
      proof.paymentId ? [[proof.paymentId, proof] as const] : []
    )
  )

  return invoices.map((row) => {
    const paidOnIt = payments.filter((p) => p.invoiceId === row.id)
    return {
      id: row.id,
      leaseId: row.leaseId,
      number: formatInvoiceNumber(row.number),
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      issuedOn: row.issuedOn,
      dueOn: row.dueOn,
      lines: row.lines,
      total: row.total,
      currency: row.currency,
      voidedAt: row.voidedAt,
      paid:
        Math.round(paidOnIt.reduce((total, p) => total + p.amount, 0) * 100) /
        100,
      payments: paidOnIt.map((p) => ({
        id: p.id,
        amount: p.amount,
        paidOn: p.paidOn,
        note: p.note,
        proof: proofFile(proofOfPayment.get(p.id)),
      })),
      proofs: proofs
        .filter((proof) => proof.invoiceId === row.id && !proof.paymentId)
        .map(toPaymentProof),
    }
  })
}

function proofFile(proof: typeof paymentProof.$inferSelect | undefined) {
  return proof
    ? { id: proof.id, fileName: proof.fileName, mimeType: proof.mimeType }
    : null
}
