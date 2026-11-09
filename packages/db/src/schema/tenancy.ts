import { relations, sql } from "drizzle-orm"
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"
import { property } from "./property"

/*
 * Who rents what, and the rent paid. A tenant is a `user`-role account in the
 * business's organization; what the business records about them (phone,
 * mailing address, other contacts, notes) lives in `user.metadata`. Every table here
 * also hangs off the organization, so deleting a business takes all of it
 * along. The guards that protect money (no deleting a tenant, lease or
 * property once rent has been paid on it) live in the API, next to the error
 * messages that explain them.
 */

/**
 * A tenant occupying a property from `startDate` (entry) until `endDate`
 * (exit, inclusive; open-ended while null). Leases of one property never
 * overlap. Terminating one fixes its `endDate` and stamps `terminatedAt`.
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
    tenantId: uuid("tenant_id")
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
    index("lease_tenantId_idx").on(table.tenantId),
    index("lease_propertyId_idx").on(table.propertyId),
  ]
)

/** Rent received on a lease, in the lease's currency. */
export const payment = pgTable(
  "payment",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => lease.id, { onDelete: "cascade" }),
    amount: numeric("amount", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("payment_leaseId_idx").on(table.leaseId)]
)

export const propertyRelations = relations(property, ({ one, many }) => ({
  organization: one(organization, {
    fields: [property.organizationId],
    references: [organization.id],
  }),
  leases: many(lease),
}))

export const leaseRelations = relations(lease, ({ one, many }) => ({
  tenant: one(user, { fields: [lease.tenantId], references: [user.id] }),
  property: one(property, {
    fields: [lease.propertyId],
    references: [property.id],
  }),
  payments: many(payment),
}))

export const paymentRelations = relations(payment, ({ one }) => ({
  lease: one(lease, { fields: [payment.leaseId], references: [lease.id] }),
}))
