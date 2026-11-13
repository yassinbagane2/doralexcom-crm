import { relations, sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"
import { property } from "./property"

/*
 * Who rents what, and the rent paid. A customer is a `user`-role account in the
 * business's organization; what the business records about them (phone,
 * mailing address, other contacts, notes) lives in `user.metadata`. Every table here
 * also hangs off the organization, so deleting a business takes all of it
 * along. The guards that protect money (no deleting a customer, lease or
 * property once rent has been paid on it) live in the API, next to the error
 * messages that explain them.
 */

/**
 * A customer occupying a property from `startDate` (entry) until `endDate`
 * (exit, inclusive; open-ended while null). Leases of one property never
 * overlap. Terminating one fixes its `endDate` and stamps `terminatedAt`.
 *
 * A lease agreed for `termMonths` ends on the day before that many months
 * have passed. With `autoRenew` it starts another term of the same length
 * each time one ends, so until it is terminated it holds the property
 * open-ended; `endDate` stays the end of the first term.
 */
export const lease = pgTable(
  "lease",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    /** Monthly rent, charged in advance from `startDate`. */
    rent: numeric("rent", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    /** Monthly service charges (maintenance, utilities…), billed with rent. */
    charges: numeric("charges", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    /** Other monthly costs billed with rent (parking, internet…). */
    additionalCosts: numeric("additional_costs", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .default(0)
      .notNull(),
    /** Taken off every month's bill. */
    discount: numeric("discount", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    /** Security deposit held for the lease. Not part of what's billed. */
    deposit: numeric("deposit", { precision: 12, scale: 2, mode: "number" })
      .default(0)
      .notNull(),
    /** Length agreed, in months; null when set by an exit date or open-ended. */
    termMonths: integer("term_months"),
    autoRenew: boolean("auto_renew").default(false).notNull(),
    currency: text("currency", { enum: ["RON", "EUR"] })
      .default("RON")
      .notNull(),
    terminatedAt: timestamp("terminated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("lease_organizationId_idx").on(table.organizationId),
    index("lease_customerId_idx").on(table.customerId),
    index("lease_propertyId_idx").on(table.propertyId),
  ]
)

/** One line of an invoice; a discount is a negative amount. */
export interface InvoiceLineRow {
  kind: "rent" | "charges" | "additionalCosts" | "discount" | "deposit"
  amount: number
}

/**
 * What a customer is asked to pay for one month of a lease, in advance: the
 * monthly bill (prorated for a final, partial month), plus the deposit on the
 * lease's first invoice. Issued when the lease is created for its first
 * month (and any already begun), then on each rent date; due a few days
 * after it is issued. `number` counts up per organization. A voided invoice
 * stays on record but is no longer owed.
 */
export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** The month billed: its first and last day. */
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    issuedOn: date("issued_on", { mode: "string" }).notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    lines: jsonb("lines").$type<InvoiceLineRow[]>().notNull(),
    total: numeric("total", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    currency: text("currency", { enum: ["RON", "EUR"] }).notNull(),
    voidedAt: timestamp("voided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoice_organizationId_idx").on(table.organizationId),
    index("invoice_leaseId_idx").on(table.leaseId),
    uniqueIndex("invoice_organization_number_idx").on(
      table.organizationId,
      table.number
    ),
    // One live invoice per month of a lease: issuing twice is a no-op, but
    // a voided month can be issued again.
    uniqueIndex("invoice_lease_period_idx")
      .on(table.leaseId, table.periodStart)
      .where(sql`voided_at is null`),
  ]
)

/**
 * Money received against one invoice, in the invoice's currency. An invoice
 * can be paid in several parts. Payments belong to invoices only: the lease is
 * the agreement, and reaches its payments through the invoices it produced.
 */
export const payment = pgTable(
  "payment",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    amount: numeric("amount", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("payment_invoiceId_idx").on(table.invoiceId)]
)

export const PAYMENT_PROOF_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
] as const

/**
 * Proof of a payment made outside the app (a bank transfer confirmation, a
 * photo of a receipt), uploaded by the customer against one invoice. It waits
 * for the business: confirming it records the payment it describes, linked
 * here; rejecting it keeps it on record with the reason. The business can
 * also attach proof to a payment it records itself, confirmed from the start.
 * The file lives in R2 (see the API's storage.ts), under a key derived from
 * the row. One proof at a time waits on an invoice.
 */
export const paymentProof = pgTable(
  "payment_proof",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    /** Set once confirmed; removing the payment removes its proof. */
    paymentId: uuid("payment_id").references(() => payment.id, {
      onDelete: "cascade",
    }),
    status: text("status", { enum: PAYMENT_PROOF_STATUSES })
      .default("pending")
      .notNull(),
    /** What the proof says was paid, and when. */
    amount: numeric("amount", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    submittedById: uuid("submitted_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedById: uuid("reviewed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("paymentProof_invoiceId_idx").on(table.invoiceId),
    uniqueIndex("paymentProof_paymentId_idx").on(table.paymentId),
    uniqueIndex("paymentProof_pending_idx")
      .on(table.invoiceId)
      .where(sql`status = 'pending'`),
  ]
)

export const propertyRelations = relations(property, ({ one, many }) => ({
  organization: one(organization, {
    fields: [property.organizationId],
    references: [organization.id],
  }),
  leases: many(lease),
}))

export const leaseRelations = relations(lease, ({ one, many }) => ({
  customer: one(user, { fields: [lease.customerId], references: [user.id] }),
  property: one(property, {
    fields: [lease.propertyId],
    references: [property.id],
  }),
  invoices: many(invoice),
}))

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
  lease: one(lease, { fields: [invoice.leaseId], references: [lease.id] }),
  payments: many(payment),
  paymentProofs: many(paymentProof),
}))

export const paymentRelations = relations(payment, ({ one }) => ({
  invoice: one(invoice, {
    fields: [payment.invoiceId],
    references: [invoice.id],
  }),
}))

export const paymentProofRelations = relations(paymentProof, ({ one }) => ({
  invoice: one(invoice, {
    fields: [paymentProof.invoiceId],
    references: [invoice.id],
  }),
  payment: one(payment, {
    fields: [paymentProof.paymentId],
    references: [payment.id],
  }),
}))
