import { relations, sql } from "drizzle-orm"
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"
import { lease } from "./tenancy"

/*
 * Contracts and the files kept about tenants. The shape of the editor content
 * (`content` columns) is validated by the API (packages/api/src/contract.ts),
 * which owns it; here it is opaque JSON.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
})

/**
 * A document a business writes once and reuses: rich text with merge fields
 * that fill in from the landlord, tenant, property and lease.
 */
export const template = pgTable(
  "template",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("template_organizationId_idx").on(table.organizationId),
  ]
)

/**
 * A document attached to a tenant, optionally about one of their leases:
 * either a file uploaded as is (`kind` "file": a signed lease, an ID scan…)
 * or a contract generated from a template and still editable (`kind`
 * "contract"). Deleting the lease keeps the document on the tenant.
 */
export const tenantDocument = pgTable(
  "tenant_document",
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
    leaseId: uuid("lease_id").references(() => lease.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["file", "contract"] }).notNull(),
    name: text("name").notNull(),
    /** Files only: what was uploaded. */
    mimeType: text("mime_type"),
    size: integer("size"),
    data: bytea("data"),
    /** Contracts only: the editor content. */
    content: jsonb("content").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("tenantDocument_organizationId_idx").on(table.organizationId),
    index("tenantDocument_tenantId_idx").on(table.tenantId),
    index("tenantDocument_leaseId_idx").on(table.leaseId),
  ]
)

export const tenantDocumentRelations = relations(tenantDocument, ({ one }) => ({
  tenant: one(user, {
    fields: [tenantDocument.tenantId],
    references: [user.id],
  }),
  lease: one(lease, {
    fields: [tenantDocument.leaseId],
    references: [lease.id],
  }),
}))
