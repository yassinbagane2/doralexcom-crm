import { sql } from "drizzle-orm"
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { organization } from "./auth"

/*
 * Something a business rents out. Who occupies it, and when, lives on its
 * leases (./customer.ts). Keep the `type` and `currency` lists in step
 * with packages/api/src/property.ts, which the web forms read: the router's
 * inserts fail the typecheck if the two drift apart.
 */
export const property = pgTable(
  "property",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["apartment", "building", "office", "garage", "parking", "other"],
    }).notNull(),
    /** How the business tells it apart: "Apt. 12", "Spot B4"… */
    name: text("name").notNull(),
    address: text("address").notNull(),
    /** Square metres. */
    surfaceArea: numeric("surface_area", {
      precision: 10,
      scale: 2,
      mode: "number",
    }),
    description: text("description"),
    doorCode: text("door_code"),
    phone: text("phone"),
    /** Monthly rent, in `currency`. */
    rent: numeric("rent", { precision: 12, scale: 2, mode: "number" }),
    currency: text("currency", { enum: ["RON", "EUR"] })
      .default("RON")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("property_organizationId_idx").on(table.organizationId)]
)

/**
 * A photo of a property. The image lives in R2 (see the API's storage.ts),
 * under a key derived from the row; the row says where it sits among the
 * property's photos, lowest `position` first. The first one is the cover.
 * Photos are never changed in place: a new picture is a new row.
 */
export const propertyPhoto = pgTable(
  "property_photo",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("property_photo_propertyId_idx").on(table.propertyId, table.position),
  ]
)
