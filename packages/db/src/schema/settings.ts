import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"

/*
 * A business's settings beyond its legal details (which live on
 * `organization`). Keep the provider list in step with
 * packages/api/src/settings.ts, which the web forms read.
 */

/**
 * The email service a business sends its messages through, instead of the
 * platform's. `secret` is the API key (Resend, Postmark) or the SMTP password,
 * encrypted by the API before it is stored; it never leaves the server.
 */
export const emailSettings = pgTable("email_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  provider: text("provider", {
    enum: ["resend", "postmark", "smtp"],
  }).notNull(),
  fromName: text("from_name"),
  fromEmail: text("from_email").notNull(),
  replyTo: text("reply_to"),
  /** SMTP only. */
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  /** SMTP only: TLS from the start (465) rather than STARTTLS. */
  smtpSecure: boolean("smtp_secure").default(false).notNull(),
  smtpUsername: text("smtp_username"),
  secret: text("secret").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

/**
 * A web address a business serves the app from (`portal.example.com`). It is
 * `pending` until DNS shows both that the business controls the name (a TXT
 * record holding `verificationToken`) and that it points at the platform;
 * then `active`, and only then will the TLS proxy request a certificate for
 * it. One per business; a hostname is active for one business at most.
 */
export const customDomain = pgTable(
  "custom_domain",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    verificationToken: text("verification_token").notNull(),
    status: text("status", { enum: ["pending", "active"] })
      .default("pending")
      .notNull(),
    verifiedAt: timestamp("verified_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    /** Why the last check failed, as a code the web app translates. */
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("customDomain_hostname_idx").on(table.hostname),
    uniqueIndex("customDomain_active_hostname_idx")
      .on(table.hostname)
      .where(sql`status = 'active'`),
  ]
)

/**
 * The signature a business signs its contracts with, set by its owner and
 * applied for it whenever a contract is sent for signature. `image` is a PNG
 * as a data URL; `signerName` is printed with it.
 */
export const organizationSignature = pgTable("organization_signature", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  signerName: text("signer_name").notNull(),
  image: text("image").notNull(),
  updatedById: uuid("updated_by_id").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})
