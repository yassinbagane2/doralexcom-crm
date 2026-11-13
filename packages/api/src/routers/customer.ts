import { newPasswordSchema } from "@workspace/auth/password"
import { db } from "@workspace/db"
import {
  invoice,
  lease,
  member,
  organization,
  payment,
  property,
  user,
} from "@workspace/db/schema"
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o, protectedProcedure } from "../index"
import {
  CUSTOMER_GROUPS,
  CUSTOMER_LIMITS,
  localToday,
  type CustomerGroup,
  NOTE_VISIBILITIES,
} from "../lease"
import {
  addCustomerNote,
  createCustomerAccount,
  deleteCustomerAccount,
  findCustomer,
  readCustomerMetadata,
  removeCustomerNote,
  setCustomerDetails,
  customerMetadataInput,
  customerScope,
} from "../lib/customer"
import { invoiceSchema, loadInvoices } from "../lib/invoice"
import { containing, customerInGroup } from "../lib/lease"
import { paginatedOutput, pageOffset, paginationShape } from "../pagination"
import { PROPERTY_TYPES, RENT_CURRENCIES } from "../property"

const leaseSummarySchema = z.object({
  id: z.string(),
  property: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(PROPERTY_TYPES),
    address: z.string(),
  }),
  startDate: z.string(),
  endDate: z.string().nullable(),
  termMonths: z.number().nullable(),
  autoRenew: z.boolean(),
  rent: z.number(),
  charges: z.number(),
  additionalCosts: z.number(),
  discount: z.number(),
  deposit: z.number(),
  currency: z.enum(RENT_CURRENCIES),
  terminatedAt: z.date().nullable(),
  /** Total of the lease's live invoices, and what was paid on them. */
  invoiced: z.number(),
  paid: z.number(),
})

const contactSchema = z.object({
  name: z.string(),
  relation: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
})

const customerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  banned: z.boolean(),
  createdAt: z.date(),
  leases: z.array(leaseSummarySchema),
})

const customerDetailSchema = customerSummarySchema.extend({
  address: z.string().nullable(),
  contacts: z.array(contactSchema),
  notes: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      visibility: z.enum(NOTE_VISIBILITIES),
      authorName: z.string().nullable(),
      createdAt: z.date(),
    })
  ),
  leases: z.array(
    leaseSummarySchema.extend({
      /** Newest month first, each with the payments made on it. */
      invoices: z.array(invoiceSchema),
    })
  ),
})

function newestFirst<T extends { createdAt: string }>(notes: T[]) {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const customerName = z.string().trim().min(1).max(CUSTOMER_LIMITS.name)

/** The reader's own calendar day; the server's when not given. */
const readerToday = z.iso
  .date()
  .optional()
  .transform((day) => day ?? localToday())

/** Customers whose name, email, phone or a rented property's name holds `search`. */
function customerMatches(search: string) {
  const pattern = containing(search)
  return or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    sql`${user.metadata}->>'phone' ilike ${pattern}`,
    sql`exists (select 1 from ${lease} inner join ${property} on ${property.id} = ${lease.propertyId} where ${lease.customerId} = ${user.id} and ${property.name} ilike ${pattern})`
  )
}

/**
 * Leases of the given customers, with their property and what their invoices
 * add up to: billed, and paid on them.
 */
async function loadLeases(customerIds: string[]) {
  if (customerIds.length === 0) return []

  const paid = db
    .select({
      leaseId: invoice.leaseId,
      total: sql<string>`sum(${payment.amount})`.as("total"),
    })
    .from(payment)
    .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
    .groupBy(invoice.leaseId)
    .as("paid")

  const invoiced = db
    .select({
      leaseId: invoice.leaseId,
      total: sql<string>`sum(${invoice.total})`.as("invoiced_total"),
    })
    .from(invoice)
    .where(isNull(invoice.voidedAt))
    .groupBy(invoice.leaseId)
    .as("invoiced")

  const rows = await db
    .select({
      lease,
      property: {
        id: property.id,
        name: property.name,
        type: property.type,
        address: property.address,
      },
      paid: paid.total,
      invoiced: invoiced.total,
    })
    .from(lease)
    .innerJoin(property, eq(property.id, lease.propertyId))
    .leftJoin(paid, eq(paid.leaseId, lease.id))
    .leftJoin(invoiced, eq(invoiced.leaseId, lease.id))
    .where(inArray(lease.customerId, customerIds))
    .orderBy(desc(lease.startDate))

  return rows.map((row) => ({
    customerId: row.lease.customerId,
    id: row.lease.id,
    property: row.property,
    startDate: row.lease.startDate,
    endDate: row.lease.endDate,
    termMonths: row.lease.termMonths,
    autoRenew: row.lease.autoRenew,
    rent: row.lease.rent,
    charges: row.lease.charges,
    additionalCosts: row.lease.additionalCosts,
    discount: row.lease.discount,
    deposit: row.lease.deposit,
    currency: row.lease.currency,
    terminatedAt: row.lease.terminatedAt,
    invoiced: Number(row.invoiced ?? 0),
    paid: Number(row.paid ?? 0),
  }))
}

/**
 * The people a business rents to: the `user` accounts in its organization,
 * with the details kept in their metadata. Nothing here reaches outside
 * `context.organizationId`, except `mine`, which shows a signed-in customer
 * their own leases.
 */
export const customerRouter = o.prefix("/customers").router({
  /**
   * A page of customers, by name. `group` keeps those in one of the lists the
   * web app sorts customers into, as of the reader's `today`; `search` matches
   * name, email, phone or a rented property's name.
   */
  list: businessProcedure
    .route({ method: "GET", path: "/", tags: ["customers"] })
    .input(
      z.object({
        ...paginationShape,
        group: z.enum(CUSTOMER_GROUPS).optional(),
        today: readerToday,
      })
    )
    .output(paginatedOutput(customerSummarySchema))
    .handler(async ({ input, context }) => {
      const { page, pageSize, search, group, today } = input
      const where = and(
        customerScope(context.organizationId),
        group ? customerInGroup(group, user.id, today) : undefined,
        search ? customerMatches(search) : undefined
      )

      const [customers, [counted]] = await Promise.all([
        db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            banned: user.banned,
            metadata: user.metadata,
            createdAt: user.createdAt,
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(where)
          .orderBy(asc(user.name), asc(user.id))
          .limit(pageSize)
          .offset(pageOffset(page, pageSize)),
        db
          .select({ total: count() })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(where),
      ])

      const leases = await loadLeases(customers.map((t) => t.id))
      const total = counted?.total ?? 0

      return {
        data: customers.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          phone: readCustomerMetadata(t.metadata).phone,
          banned: Boolean(t.banned),
          createdAt: t.createdAt,
          leases: leases.filter((l) => l.customerId === t.id),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    }),

  /** How many customers each filter of the list holds, as of `today`. */
  groupCounts: businessProcedure
    .route({ method: "GET", path: "/group-counts", tags: ["customers"] })
    .input(z.object({ today: readerToday }))
    .output(
      z.object({
        all: z.number(),
        current: z.number(),
        incoming: z.number(),
        outgoing: z.number(),
        previous: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const inGroup = (group: CustomerGroup) =>
        sql<number>`count(*) filter (where ${customerInGroup(group, user.id, input.today)})`.mapWith(
          Number
        )

      const [counts] = await db
        .select({
          all: count(),
          current: inGroup("current"),
          incoming: inGroup("incoming"),
          outgoing: inGroup("outgoing"),
          previous: inGroup("previous"),
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(customerScope(context.organizationId))

      return (
        counts ?? { all: 0, current: 0, incoming: 0, outgoing: 0, previous: 0 }
      )
    }),

  get: businessProcedure
    .route({ method: "GET", path: "/{id}", tags: ["customers"] })
    .input(z.object({ id: z.uuid() }))
    .output(customerDetailSchema)
    .handler(async ({ input, context }) => {
      const found = await findCustomer(context.organizationId, input.id)

      const [account] = await db
        .select({ banned: user.banned, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, found.id))

      const leases = await loadLeases([found.id])

      const invoices = await loadInvoices(leases.map((l) => l.id))

      const details = readCustomerMetadata(found.metadata)

      return {
        id: found.id,
        name: found.name,
        email: found.email,
        phone: details.phone,
        address: details.address,
        contacts: details.contacts,
        banned: Boolean(account?.banned),
        createdAt: account?.createdAt ?? new Date(),
        notes: newestFirst(details.notes).map((note) => ({
          id: note.id,
          body: note.body,
          visibility: note.visibility,
          authorName: note.authorName,
          createdAt: new Date(note.createdAt),
        })),
        leases: leases.map((l) => ({
          ...l,
          invoices: invoices.filter((invoice) => invoice.leaseId === l.id),
        })),
      }
    }),

  /** A new customer is a new `user` account, signing in with these details. */
  create: businessProcedure
    .route({ method: "POST", path: "/", tags: ["customers"] })
    .input(
      customerMetadataInput.extend({
        name: customerName,
        email: z.email().transform((email) => email.toLowerCase()),
        password: newPasswordSchema,
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { name, email, password, ...details } = input
      const id = await createCustomerAccount(
        context.organizationId,
        { name, email, password },
        details
      )
      return { id }
    }),

  /** Name and details. The email is the customer's sign-in, so it stays. */
  update: businessProcedure
    .route({ method: "PUT", path: "/{id}", tags: ["customers"] })
    .input(customerMetadataInput.extend({ id: z.uuid(), name: customerName }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { id, name, ...details } = input
      await setCustomerDetails(context.organizationId, id, name, details)

      return { id }
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["customers"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      await deleteCustomerAccount(context.organizationId, input.id)
      return { success: true }
    }),

  addNote: businessProcedure
    .route({ method: "POST", path: "/{customerId}/notes", tags: ["customers"] })
    .input(
      z.object({
        customerId: z.uuid(),
        body: z.string().trim().min(1).max(CUSTOMER_LIMITS.note),
        visibility: z.enum(NOTE_VISIBILITIES),
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const id = crypto.randomUUID()
      await addCustomerNote(context.organizationId, input.customerId, {
        id,
        body: input.body,
        visibility: input.visibility,
        authorId: context.session.user.id,
        authorName: context.session.user.name,
        createdAt: new Date().toISOString(),
      })

      return { id }
    }),

  removeNote: businessProcedure
    .route({
      method: "DELETE",
      path: "/{customerId}/notes/{id}",
      tags: ["customers"],
    })
    .input(z.object({ customerId: z.uuid(), id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      await removeCustomerNote(
        context.organizationId,
        input.customerId,
        input.id
      )
      return { success: true }
    }),

  /**
   * For a signed-in customer: the places they rent and the notes shared with
   * them. Private notes, payments and other customers never appear here.
   */
  mine: protectedProcedure
    .route({ method: "GET", path: "/mine", tags: ["customers"] })
    .output(
      z.object({
        landlord: z.string().nullable(),
        leases: z.array(
          z.object({
            id: z.string(),
            property: z.object({
              name: z.string(),
              type: z.enum(PROPERTY_TYPES),
              address: z.string(),
              doorCode: z.string().nullable(),
              phone: z.string().nullable(),
            }),
            startDate: z.string(),
            endDate: z.string().nullable(),
            termMonths: z.number().nullable(),
            autoRenew: z.boolean(),
            terminatedAt: z.date().nullable(),
            rent: z.number(),
            charges: z.number(),
            additionalCosts: z.number(),
            discount: z.number(),
            deposit: z.number(),
            currency: z.enum(RENT_CURRENCIES),
          })
        ),
        notes: z.array(
          z.object({ id: z.string(), body: z.string(), createdAt: z.date() })
        ),
      })
    )
    .handler(async ({ context }) => {
      const me = context.session.user.id

      const [landlord, leases, [account]] = await Promise.all([
        db
          .select({ name: organization.name })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .where(eq(member.userId, me))
          .orderBy(asc(member.createdAt))
          .limit(1),
        db
          .select({
            lease,
            property: {
              name: property.name,
              type: property.type,
              address: property.address,
              doorCode: property.doorCode,
              phone: property.phone,
            },
          })
          .from(lease)
          .innerJoin(property, eq(property.id, lease.propertyId))
          .where(eq(lease.customerId, me))
          .orderBy(desc(lease.startDate)),
        db
          .select({ metadata: user.metadata })
          .from(user)
          .where(eq(user.id, me)),
      ])

      // Only notes the business chose to share; private ones stay server-side.
      const notes = newestFirst(readCustomerMetadata(account?.metadata).notes)
        .filter((note) => note.visibility === "shared")
        .map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: new Date(note.createdAt),
        }))

      return {
        landlord: landlord[0]?.name ?? null,
        leases: leases.map((row) => ({
          id: row.lease.id,
          property: row.property,
          startDate: row.lease.startDate,
          endDate: row.lease.endDate,
          termMonths: row.lease.termMonths,
          autoRenew: row.lease.autoRenew,
          terminatedAt: row.lease.terminatedAt,
          rent: row.lease.rent,
          charges: row.lease.charges,
          additionalCosts: row.lease.additionalCosts,
          discount: row.lease.discount,
          deposit: row.lease.deposit,
          currency: row.lease.currency,
        })),
        notes,
      }
    }),
})
