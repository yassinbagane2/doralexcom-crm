import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import {
  lease,
  payment,
  property,
  propertyPhoto,
  user,
} from "@workspace/db/schema"
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  notExists,
  or,
  sql,
} from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { effectiveEnd, localToday } from "../lease"
import { containing, holdsPropertyOn, leaseCurrent } from "../lib/lease"
import { discardPropertyPhotos } from "../lib/storage"
import { paginatedOutput, pageOffset, paginationShape } from "../pagination"
import { PROPERTY_LIMITS, PROPERTY_TYPES, RENT_CURRENCIES } from "../property"
import { photosOf } from "./property-photo"

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
  /** In order: the first one is the cover. */
  photos: z.array(z.object({ id: z.string() })),
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

/** Leases of this property the customer lives under on `today`. */
const currentLeases = (propertyId: typeof property.id, today: string) =>
  db
    .select({ one: sql`1` })
    .from(lease)
    .where(and(eq(lease.propertyId, propertyId), leaseCurrent(today)))

/** Rent ever received on any lease of this property. */
const paymentsOn = (propertyId: typeof property.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .innerJoin(lease, eq(lease.id, payment.leaseId))
    .where(eq(lease.propertyId, propertyId))

/** Leases shown with a property: holding it since the reader's yesterday. */
const shownLease = holdsPropertyOn(sql`current_date - 1`)

/** Properties whose name or address holds `search`, or rented to someone whose name does. */
function propertyMatches(search: string) {
  const pattern = containing(search)
  return or(
    ilike(property.name, pattern),
    ilike(property.address, pattern),
    sql`exists (select 1 from ${lease} inner join ${user} on ${user.id} = ${lease.customerId} where ${lease.propertyId} = ${property.id} and ${shownLease} and ${user.name} ilike ${pattern})`
  )
}

/**
 * By name, numbers in their natural order ("Apt. 2" before "Apt. 10"): the
 * text before the first number, then that number, then the whole name.
 */
const byName = [
  sql`lower(regexp_replace(${property.name}, '[0-9].*$', ''))`,
  sql`substring(${property.name} from '[0-9]+')::numeric nulls first`,
  sql`lower(${property.name})`,
  asc(property.id),
]

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
  /** A page of properties, by name; `type` and `search` narrow it down. */
  list: businessProcedure
    .route({ method: "GET", path: "/", tags: ["properties"] })
    .input(
      z.object({
        ...paginationShape,
        type: z.enum(PROPERTY_TYPES).optional(),
      })
    )
    .output(paginatedOutput(propertySchema))
    .handler(async ({ input, context }) => {
      const { page, pageSize, search, type } = input
      const where = and(
        eq(property.organizationId, context.organizationId),
        type ? eq(property.type, type) : undefined,
        search ? propertyMatches(search) : undefined
      )

      const [rows, [counted]] = await Promise.all([
        db
          .select()
          .from(property)
          .where(where)
          .orderBy(...byName)
          .limit(pageSize)
          .offset(pageOffset(page, pageSize)),
        db.select({ total: count() }).from(property).where(where),
      ])

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
                shownLease
              )
            )
            .orderBy(asc(lease.startDate))
        : []

      const photos = await photosOf(rows.map((row) => row.id))
      const total = counted?.total ?? 0

      return {
        data: rows.map((row) => ({
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
          photos: photos.get(row.id) ?? [],
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
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    }),

  /**
   * Totals for the page header, as of the reader's `today`: how many
   * properties there are, how many are lived in, and which kinds exist.
   */
  summary: businessProcedure
    .route({ method: "GET", path: "/summary", tags: ["properties"] })
    .input(z.object({ today: z.iso.date().optional() }))
    .output(
      z.object({
        total: z.number(),
        occupied: z.number(),
        types: z.array(z.enum(PROPERTY_TYPES)),
      })
    )
    .handler(async ({ input, context }) => {
      const today = input.today ?? localToday()
      const ours = eq(property.organizationId, context.organizationId)
      const [rows, [lived]] = await Promise.all([
        db
          .select({ type: property.type, total: count() })
          .from(property)
          .where(ours)
          .groupBy(property.type),
        db
          .select({ total: count() })
          .from(property)
          .where(and(ours, exists(currentLeases(property.id, today)))),
      ])

      return {
        total: rows.reduce((sum, row) => sum + row.total, 0),
        occupied: lived?.total ?? 0,
        types: PROPERTY_TYPES.filter((type) =>
          rows.some((row) => row.type === type)
        ),
      }
    }),

  /**
   * One property with every lease it has had, oldest first: past ones too, so
   * its page can show who lived there before.
   */
  get: businessProcedure
    .route({ method: "GET", path: "/{id}", tags: ["properties"] })
    .input(z.object({ id: z.uuid() }))
    .output(
      propertySchema.extend({
        leases: z.array(
          z.object({
            id: z.string(),
            startDate: z.string(),
            endDate: z.string().nullable(),
            terminatedAt: z.date().nullable(),
            rent: z.number(),
            currency: z.enum(RENT_CURRENCIES),
            customer: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().nullable(),
            }),
          })
        ),
      })
    )
    .handler(async ({ input, context }) => {
      const [row] = await db
        .select()
        .from(property)
        .where(
          and(
            eq(property.id, input.id),
            eq(property.organizationId, context.organizationId)
          )
        )

      if (!row) throw notFound()

      const [leases, photos] = await Promise.all([
        db
          .select({
            id: lease.id,
            startDate: lease.startDate,
            endDate: lease.endDate,
            autoRenew: lease.autoRenew,
            termMonths: lease.termMonths,
            terminatedAt: lease.terminatedAt,
            rent: lease.rent,
            currency: lease.currency,
            customer: { id: user.id, name: user.name, email: user.email },
          })
          .from(lease)
          .innerJoin(user, eq(user.id, lease.customerId))
          .where(eq(lease.propertyId, row.id))
          .orderBy(asc(lease.startDate)),
        photosOf([row.id]),
      ])

      return {
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
        photos: photos.get(row.id) ?? [],
        leases: leases.map((l) => ({
          id: l.id,
          startDate: l.startDate,
          // When the customer leaves: never, while the lease keeps renewing.
          endDate: effectiveEnd(l),
          terminatedAt: l.terminatedAt,
          rent: l.rent,
          currency: l.currency,
          customer: l.customer,
        })),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
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

      // Its photos go with it (FK cascade); their images are cleared after.
      const photos = await db
        .select({
          id: propertyPhoto.id,
          organizationId: propertyPhoto.organizationId,
          propertyId: propertyPhoto.propertyId,
        })
        .from(propertyPhoto)
        .where(
          and(
            eq(propertyPhoto.propertyId, input.id),
            eq(propertyPhoto.organizationId, context.organizationId)
          )
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

      if (deleted.length > 0) {
        await discardPropertyPhotos(photos)
        return { success: true }
      }

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
