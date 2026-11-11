import { relations, sql } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"
import { lease } from "./leasing"

/*
 * Contracts and the files kept about customers. The shape of the editor content
 * (`content` columns) is validated by the API (packages/api/src/contract.ts),
 * which owns it; here it is opaque JSON.
 */

/**
 * A document a business writes once and reuses: rich text with merge fields
 * that fill in from the landlord, customer, property and lease.
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
  (table) => [index("template_organizationId_idx").on(table.organizationId)]
)

/**
 * A document attached to a customer, optionally about one of their leases:
 * either a file uploaded as is (`kind` "file": a signed lease, an ID scan…)
 * or a contract generated from a template and still editable (`kind`
 * "contract"). Deleting the lease keeps the document on the customer.
 *
 * The content itself (the file, or the contract's editor JSON) is kept in
 * Cloudflare R2 under a key derived from this row: see the API's
 * lib/storage.ts.
 */
export const customerDocument = pgTable(
  "customer_document",
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
    leaseId: uuid("lease_id").references(() => lease.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["file", "contract"] }).notNull(),
    name: text("name").notNull(),
    /** Files only: what was uploaded. */
    mimeType: text("mime_type"),
    size: integer("size"),
    /**
     * Contracts sent for signature: `pending` while the customer hasn't
     * signed, `completed` once they have. Null for a draft. Either way the
     * content is frozen: `contentHash` is the SHA-256 of it as sent.
     */
    signatureStatus: text("signature_status", {
      enum: ["pending", "completed"],
    }),
    sentAt: timestamp("sent_at"),
    completedAt: timestamp("completed_at"),
    contentHash: text("content_hash"),
    /** SHA-256 of the signed PDF, once it has been rendered. */
    signedFileHash: text("signed_file_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("customerDocument_organizationId_idx").on(table.organizationId),
    index("customerDocument_customerId_idx").on(table.customerId),
    index("customerDocument_leaseId_idx").on(table.leaseId),
  ]
)

export const SIGNER_ROLES = ["landlord", "customer"] as const

/**
 * A party's signature on a contract sent for signature: the business's own,
 * applied when the contract is sent, and the customer's. `image` is a PNG as
 * a data URL; it fills every signature field placed for that role.
 */
export const documentSignature = pgTable(
  "document_signature",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => customerDocument.id, { onDelete: "cascade" }),
    role: text("role", { enum: SIGNER_ROLES }).notNull(),
    signerUserId: uuid("signer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email"),
    image: text("image").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    signedAt: timestamp("signed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("documentSignature_document_role_idx").on(
      table.documentId,
      table.role
    ),
  ]
)

export const DOCUMENT_EVENT_TYPES = [
  "sent",
  "viewed",
  "signed",
  "completed",
  "withdrawn",
] as const

/**
 * The audit trail of a contract sent for signature: who did what, when,
 * and from where. Printed at the end of the signed PDF.
 */
export const documentEvent = pgTable(
  "document_event",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => customerDocument.id, { onDelete: "cascade" }),
    type: text("type", { enum: DOCUMENT_EVENT_TYPES }).notNull(),
    role: text("role", { enum: SIGNER_ROLES }),
    actorUserId: uuid("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name"),
    actorEmail: text("actor_email"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("documentEvent_documentId_idx").on(table.documentId)]
)

export const customerDocumentRelations = relations(
  customerDocument,
  ({ one, many }) => ({
    signatures: many(documentSignature),
    events: many(documentEvent),
    customer: one(user, {
      fields: [customerDocument.customerId],
      references: [user.id],
    }),
    lease: one(lease, {
      fields: [customerDocument.leaseId],
      references: [lease.id],
    }),
  })
)

export const documentSignatureRelations = relations(
  documentSignature,
  ({ one }) => ({
    document: one(customerDocument, {
      fields: [documentSignature.documentId],
      references: [customerDocument.id],
    }),
  })
)

export const documentEventRelations = relations(documentEvent, ({ one }) => ({
  document: one(customerDocument, {
    fields: [documentEvent.documentId],
    references: [customerDocument.id],
  }),
}))
