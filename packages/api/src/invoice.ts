import {
  addDays,
  billingPeriods,
  type BillingPeriod,
  type LeaseCharges,
  type LeaseDates,
} from "./lease"

/*
 * Invoices, shared by the API and the web app. Keep this file free of server
 * imports: it ends up in client bundles.
 *
 * A lease is billed a month at a time, in advance: one invoice per month,
 * issued when the lease is created (for its first month, and any already
 * begun) and then on each rent date. Every invoice is due a few days after
 * it is issued. The lease's first invoice also asks for the deposit.
 */

/** Days between an invoice being issued and it falling due. */
export const INVOICE_DUE_DAYS = 3

export const INVOICE_LINE_KINDS = [
  "rent",
  "charges",
  "additionalCosts",
  "discount",
  "deposit",
] as const

export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number]

/** A discount is a negative amount. */
export interface InvoiceLine {
  kind: InvoiceLineKind
  amount: number
}

export const INVOICE_STATUSES = ["open", "overdue", "paid", "void"] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

/**
 * What proof of a payment made outside the app can be: a PDF, or a photo or
 * screenshot of the transfer. Every one of them a browser shows as is.
 */
export const PAYMENT_PROOF_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

export type PaymentProofFileType = (typeof PAYMENT_PROOF_FILE_TYPES)[number]

export function isPaymentProofFileType(
  type: string
): type is PaymentProofFileType {
  return (PAYMENT_PROOF_FILE_TYPES as readonly string[]).includes(type)
}

export const PAYMENT_PROOF_LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  fileName: 200,
  rejectionReason: 300,
} as const

const cents = (amount: number) => Math.round(amount * 100) / 100

/** "0042": invoices count up per business. */
export function formatInvoiceNumber(number: number) {
  return String(number).padStart(4, "0")
}

/** When an invoice issued on `issuedOn` falls due. */
export function invoiceDueDate(issuedOn: string) {
  return addDays(issuedOn, INVOICE_DUE_DAYS)
}

/**
 * What one month of a lease bills: rent, charges and costs (a share of them
 * for a partial month), less the discount, and the deposit on the first.
 * The discount never takes the month below zero.
 */
export function invoiceLines(
  lease: LeaseCharges & { deposit?: number },
  period: Pick<BillingPeriod, "ratio">,
  withDeposit: boolean
): InvoiceLine[] {
  const share = (amount = 0) => cents(amount * period.ratio)
  const rent = share(lease.rent)
  const charges = share(lease.charges)
  const additionalCosts = share(lease.additionalCosts)
  const discount = Math.min(
    share(lease.discount),
    rent + charges + additionalCosts
  )

  const lines: InvoiceLine[] = [
    { kind: "rent", amount: rent },
    { kind: "charges", amount: charges },
    { kind: "additionalCosts", amount: additionalCosts },
    { kind: "discount", amount: -discount },
    { kind: "deposit", amount: withDeposit ? cents(lease.deposit ?? 0) : 0 },
  ]
  return lines.filter((line) => line.amount !== 0)
}

export function invoiceTotal(lines: InvoiceLine[]) {
  return cents(lines.reduce((sum, line) => sum + line.amount, 0))
}

/**
 * Where an invoice stands on `today`: void once cancelled, paid once the
 * payments on it cover it, overdue after its due date, open until then.
 */
export function invoiceStatus(
  invoice: {
    total: number
    paid: number
    dueOn: string
    voidedAt: Date | string | null
  },
  today: string
): InvoiceStatus {
  if (invoice.voidedAt) return "void"
  if (invoice.paid >= invoice.total) return "paid"
  return invoice.dueOn < today ? "overdue" : "open"
}

/** What is still owed on an invoice; nothing once void. */
export function invoiceRemaining(invoice: {
  total: number
  paid: number
  voidedAt: Date | string | null
}) {
  return invoice.voidedAt ? 0 : Math.max(0, cents(invoice.total - invoice.paid))
}

/** An invoice as far as keeping a lease's billing in step is concerned. */
export interface IssuedInvoice {
  id: string
  periodStart: string
  periodEnd: string
  total: number
  paid: number
  voidedAt: Date | string | null
}

/**
 * How a lease's invoices must change once its dates have: an unpaid invoice
 * for a month the lease no longer has (it ends sooner, or starts on another
 * day of the month) is voided, and so is an unpaid one whose month is now cut
 * short, so it can be issued again for the right amount. Invoices with money
 * paid on them are left alone: what to refund is the business's call.
 */
export function invoicesToVoid(
  invoices: IssuedInvoice[],
  lease: LeaseDates
): string[] {
  const latest = invoices.reduce(
    (max, invoice) => (invoice.periodStart > max ? invoice.periodStart : max),
    lease.startDate
  )
  const periods = new Map(
    billingPeriods(lease, latest).map((period) => [period.start, period])
  )

  return invoices
    .filter((invoice) => {
      if (invoice.voidedAt || invoice.paid > 0) return false
      const period = periods.get(invoice.periodStart)
      return !period || period.end !== invoice.periodEnd
    })
    .map((invoice) => invoice.id)
}

/** What has been invoiced on a lease, what was paid, and what's left. */
export function invoiceBalance(invoices: IssuedInvoice[]) {
  const live = invoices.filter((invoice) => !invoice.voidedAt)
  const due = cents(live.reduce((sum, invoice) => sum + invoice.total, 0))
  const paid = cents(invoices.reduce((sum, invoice) => sum + invoice.paid, 0))
  return { due, paid, balance: cents(due - paid) }
}

/** An issued invoice with its lines, as `reconcileInvoices` reads it. */
export interface IssuedInvoiceWithLines extends IssuedInvoice {
  lines: InvoiceLine[]
}

/**
 * What it takes to bring a lease's invoices in step with its dates on
 * `today`: the invoices to void (see `invoicesToVoid`), and the months to
 * invoice that have begun with none yet (always the first, even before
 * move-in), the deposit on the first of those unless already billed.
 */
export function reconcileInvoices(
  invoices: IssuedInvoiceWithLines[],
  lease: LeaseDates & LeaseCharges & { deposit?: number },
  today: string
) {
  const toVoid = invoicesToVoid(invoices, lease)
  const live = invoices.filter(
    (invoice) => !invoice.voidedAt && !toVoid.includes(invoice.id)
  )
  const billed = new Set(live.map((invoice) => invoice.periodStart))
  const depositBilled = live.some((invoice) =>
    invoice.lines.some((line) => line.kind === "deposit")
  )

  const through = today > lease.startDate ? today : lease.startDate
  const toIssue = billingPeriods(lease, through)
    .filter((period) => !billed.has(period.start))
    .map((period, index) => {
      const lines = invoiceLines(lease, period, !depositBilled && index === 0)
      return { period, lines, total: invoiceTotal(lines) }
    })

  return { toVoid, live, toIssue }
}

/**
 * The balance a lease will show once its invoices are reconciled: used to
 * preview what terminating a lease leaves owed (or to refund).
 */
export function reconciledBalance(
  invoices: IssuedInvoiceWithLines[],
  lease: LeaseDates & LeaseCharges & { deposit?: number },
  today: string
) {
  const { live, toIssue } = reconcileInvoices(invoices, lease, today)
  const due = cents(
    live.reduce((sum, invoice) => sum + invoice.total, 0) +
      toIssue.reduce((sum, issue) => sum + issue.total, 0)
  )
  const paid = cents(invoices.reduce((sum, invoice) => sum + invoice.paid, 0))
  return { due, paid, balance: cents(due - paid) }
}
