import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { lease, payment, property, user } from "@workspace/db/schema"
import { and, asc, desc, eq, inArray, notExists, sql } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { effectiveEnd } from "../lease"
import { holdsPropertyOn } from "../lib/lease"
import { PROPERTY_LIMITS, PROPERTY_TYPES, RENT_CURRENCIES } from "../property"

/** Blank text is stored as null, so "not set" has one spelling. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

const optionalAmount = (max: number) =>
  z.number().finite().nonnegative().max(max).nullable()

const propertyInput = z.object({
  type: z.enum(PROPERTY_TYPES),
  name: z.string().trim().min(1).max(PROPERTY_LIMITS.name),
  address: z.string().trim().min(1).max(PROPERTY_LIMITS.address),
  surfaceArea: optionalAmount(PROPERTY_LIMITS.surfaceArea),
  description: optionalText(PROPERTY_LIMITS.description),
  doorCode: optionalText(PROPERTY_LIMITS.doorCode),
  phone: optionalText(PROPERTY_LIMITS.phone),
  rent: optionalAmount(PROPERTY_LIMITS.rent),
  currency: z.enum(RENT_CURRENCIES),
})

const propertySchema = z.object({
  id: z.string(),
  type: z.enum(PROPERTY_TYPES),
  name: z.string(),
  address: z.string(),
  surfaceArea: z.number().nullable(),
  description: z.string().nullable(),
  doorCode: z.string().nullable(),
  phone: z.string().nullable(),
  rent: z.number().nullable(),
  currency: z.enum(RENT_CURRENCIES),
  /**
   * Leases that hold it now or later (plus any that ended yesterday, so the
   * reader's own "today" decides). The web app picks the occupant from these.
   */
  leases: z.array(
    z.object({
      id: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      customer: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
      }),
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date(),
})

/** Leases of this property still running, or not yet started. */
const openLeases = (propertyId: typeof property.id) =>
  db
    .select({ one: sql`1` })
    .from(lease)
    .where(
      and(eq(lease.propertyId, propertyId), holdsPropertyOn(sql`current_date`))
    )

/** Rent ever received on any lease of this property. */
const paymentsOn = (propertyId: typeof property.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .innerJoin(lease, eq(lease.id, payment.leaseId))
    .where(eq(lease.propertyId, propertyId))

function notFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Property not found.",
    data: { code: "PROPERTY_NOT_FOUND" },
  })
}

/**
 * The properties a business rents out. Like the business router, nothing here
 * reaches outside `context.organizationId`.
 */
export const propertyRouter = o.prefix("/properties").router({
  list: businessProcedure
    .route({ method: "GET", path: "/", tags: ["properties"] })
    .output(z.array(propertySchema))
    .handler(async ({ context }) => {
      const rows = await db
        .select()
        .from(property)
        .where(eq(property.organizationId, context.organizationId))
        .orderBy(desc(property.createdAt))

      const leases = rows.length
        ? await db
            .select({
              id: lease.id,
              propertyId: lease.propertyId,
              startDate: lease.startDate,
              endDate: lease.endDate,
              autoRenew: lease.autoRenew,
              termMonths: lease.termMonths,
              terminatedAt: lease.terminatedAt,
              customer: { id: user.id, name: user.name, email: user.email },
            })
            .from(lease)
            .innerJoin(user, eq(user.id, lease.customerId))
            .where(
              and(
                inArray(
                  lease.propertyId,
                  rows.map((row) => row.id)
                ),
                holdsPropertyOn(sql`current_date - 1`)
              )
            )
            .orderBy(asc(lease.startDate))
        : []

      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        address: row.address,
        surfaceArea: row.surfaceArea,
        description: row.description,
        doorCode: row.doorCode,
        phone: row.phone,
        rent: row.rent,
        currency: row.currency,
        leases: leases
          .filter((l) => l.propertyId === row.id)
          .map((l) => ({
            id: l.id,
            startDate: l.startDate,
            // When the customer leaves: never, while the lease keeps renewing.
            endDate: effectiveEnd(l),
            customer: l.customer,
          })),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
    }),

  create: businessProcedure
    .route({ method: "POST", path: "/", tags: ["properties"] })
    .input(propertyInput)
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const [created] = await db
        .insert(property)
        .values({ ...input, organizationId: context.organizationId })
        .returning({ id: property.id })

      return { id: created!.id }
    }),

  update: businessProcedure
    .route({ method: "PUT", path: "/{id}", tags: ["properties"] })
    .input(propertyInput.extend({ id: z.uuid() }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { id, ...values } = input

      const [updated] = await db
        .update(property)
        .set(values)
        .where(
          and(
            eq(property.id, id),
            eq(property.organizationId, context.organizationId)
          )
        )
        .returning({ id: property.id })

      if (!updated) throw notFound()

      return { id: updated.id }
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["properties"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const scope = and(
        eq(property.id, input.id),
        eq(property.organizationId, context.organizationId)
      )

      // The checks and the delete are one statement, so a lease signed a
      // moment ago can't slip past them. Past leases without payments go
      // along with the property (FK cascade).
      const deleted = await db
        .delete(property)
        .where(
          and(
            scope,
            notExists(openLeases(property.id)),
            notExists(paymentsOn(property.id))
          )
        )
        .returning({ id: property.id })

      if (deleted.length > 0) return { success: true }

      const [existing] = await db
        .select({
          inUse: sql<boolean>`exists ${openLeases(property.id)}`,
        })
        .from(property)
        .where(scope)

      if (!existing) throw notFound()

      throw existing.inUse
        ? new ORPCError("CONFLICT", {
            message: "This property has a current or upcoming lease.",
            data: { code: "PROPERTY_IN_USE" },
          })
        : new ORPCError("CONFLICT", {
            message: "Rent payments are recorded on this property.",
            data: { code: "PROPERTY_HAS_PAYMENTS" },
          })
    }),
})
