import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { lease, payment, property, user } from "@workspace/db/schema"
import {
  and,
  eq,
  exists,
  isNull,
  lte,
  ne,
  notExists,
  sql,
  sum,
} from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import {
  leaseBalance,
  MAX_TERM_MONTHS,
  TENANT_LIMITS,
  termEndDate,
} from "../lease"
import { findLandlord, landlordSchema } from "../lib/landlord"
import { holdsPropertyOn } from "../lib/lease"
import { findTenant, readTenantMetadata } from "../lib/tenant"
import { PROPERTY_LIMITS, RENT_CURRENCIES } from "../property"

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const day = z.iso.date()

const amount = z.number().finite().nonnegative().max(PROPERTY_LIMITS.rent)

/** Everything agreed on a lease but its rent. */
const agreement = z.object({
  startDate: day,
  endDate: day.nullable(),
  /** A length in months sets `endDate` itself. */
  termMonths: z.number().int().min(1).max(MAX_TERM_MONTHS).nullable(),
  /** Only a lease agreed in months can renew. */
  autoRenew: z.boolean(),
  charges: amount,
  additionalCosts: amount,
  discount: amount,
  deposit: amount,
})

const terms = agreement.extend({
  rent: amount,
  currency: z.enum(RENT_CURRENCIES),
})

type Agreement = z.output<typeof agreement>

/**
 * A lease agreed in months ends when they're up, whatever date came along;
 * any other lease can't renew, having no term to renew for.
 */
function settleTerm<T extends Agreement>(input: T): T {
  return input.termMonths
    ? { ...input, endDate: termEndDate(input.startDate, input.termMonths) }
    : { ...input, autoRenew: false }
}

/** How long the lease holds its property: a renewing one, indefinitely. */
const occupancy = (input: Agreement) => ({
  startDate: input.startDate,
  endDate: input.autoRenew ? null : input.endDate,
})

const exitAfterEntry: [
  (dates: { startDate: string; endDate: string | null }) => boolean,
  { message: string; path: string[] },
] = [
  (dates) => !dates.endDate || dates.endDate >= dates.startDate,
  {
    message: "The exit date can't come before the entry date.",
    path: ["endDate"],
  },
]

const balanceSchema = z.object({
  due: z.number(),
  paid: z.number(),
  balance: z.number(),
})

function leaseNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Lease not found.",
    data: { code: "LEASE_NOT_FOUND" },
  })
}

/**
 * Locks the property for the rest of the transaction, so two leases can't be
 * squeezed into the same dates at once, then refuses dates another lease of
 * it already covers. Both ranges include their end day; null is open-ended.
 */
async function assertPropertyFree(
  tx: Transaction,
  organizationId: string,
  propertyId: string,
  dates: { startDate: string; endDate: string | null },
  exceptLeaseId?: string
) {
  const [locked] = await tx
    .select({ rent: property.rent, currency: property.currency })
    .from(property)
    .where(
      and(
        eq(property.id, propertyId),
        eq(property.organizationId, organizationId)
      )
    )
    .for("update")

  if (!locked) {
    throw new ORPCError("NOT_FOUND", {
      message: "Property not found.",
      data: { code: "PROPERTY_NOT_FOUND" },
    })
  }

  const [clash] = await tx
    .select({ startDate: lease.startDate, endDate: lease.endDate })
    .from(lease)
    .where(
      and(
        eq(lease.propertyId, propertyId),
        exceptLeaseId ? ne(lease.id, exceptLeaseId) : undefined,
        dates.endDate ? lte(lease.startDate, dates.endDate) : undefined,
        holdsPropertyOn(dates.startDate)
      )
    )
    .limit(1)

  if (clash) {
    throw new ORPCError("CONFLICT", {
      message: "Another lease already covers those dates for this property.",
      data: { code: "LEASE_OVERLAP" },
    })
  }

  return locked
}

/** A lease of this organization, with the rent received on it. */
async function findLease(organizationId: string, id: string) {
  const [found] = await db
    .select()
    .from(lease)
    .where(and(eq(lease.id, id), eq(lease.organizationId, organizationId)))
    .limit(1)

  if (!found) throw leaseNotFound()

  const [received] = await db
    .select({ total: sum(payment.amount) })
    .from(payment)
    .where(eq(payment.leaseId, id))

  return { ...found, paid: Number(received?.total ?? 0) }
}

function assertNotTerminated(row: { terminatedAt: Date | null }) {
  if (row.terminatedAt) {
    throw new ORPCError("CONFLICT", {
      message: "This lease has been terminated.",
      data: { code: "LEASE_TERMINATED" },
    })
  }
}

const paymentsOf = (leaseId: typeof lease.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .where(eq(payment.leaseId, leaseId))

/**
 * Which property a tenant occupies, when, for how much, and the rent paid on
 * it. A new lease takes the property's rent; editing a lease can change it.
 * Scoped to `context.organizationId` like every business procedure.
 */
export const leaseRouter = o.prefix("/leases").router({
  create: businessProcedure
    .route({ method: "POST", path: "/", tags: ["leases"] })
    .input(
      agreement
        .extend({ tenantId: z.uuid(), propertyId: z.uuid() })
        .refine(...exitAfterEntry)
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input: raw, context }) => {
      const input = settleTerm(raw)
      await findTenant(context.organizationId, input.tenantId)

      const id = await db.transaction(async (tx) => {
        const rented = await assertPropertyFree(
          tx,
          context.organizationId,
          input.propertyId,
          occupancy(input)
        )
        // The lease starts at the property's rent, copied so a later change
        // to the property never rewrites what this lease has charged.
        const [created] = await tx
          .insert(lease)
          .values({
            ...input,
            rent: rented.rent ?? 0,
            currency: rented.currency,
            organizationId: context.organizationId,
          })
          .returning({ id: lease.id })
        return created!.id
      })

      return { id }
    }),

  update: businessProcedure
    .route({ method: "PUT", path: "/{id}", tags: ["leases"] })
    .input(terms.extend({ id: z.uuid() }).refine(...exitAfterEntry))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { id, ...values } = settleTerm(input)
      const current = await findLease(context.organizationId, id)
      assertNotTerminated(current)

      await db.transaction(async (tx) => {
        await assertPropertyFree(
          tx,
          context.organizationId,
          current.propertyId,
          occupancy(values),
          id
        )
        await tx
          .update(lease)
          .set(values)
          .where(and(eq(lease.id, id), isNull(lease.terminatedAt)))
      })

      return { id }
    }),

  /** Ends the lease on `endDate` for good and settles its account. */
  terminate: businessProcedure
    .route({ method: "POST", path: "/{id}/terminate", tags: ["leases"] })
    .input(z.object({ id: z.uuid(), endDate: day }))
    .output(balanceSchema)
    .handler(async ({ input, context }) => {
      const current = await findLease(context.organizationId, input.id)
      assertNotTerminated(current)

      if (input.endDate < current.startDate) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The exit date can't come before the entry date.",
          data: { code: "LEASE_END_BEFORE_START" },
        })
      }

      const terminatedAt = new Date()
      await db.transaction(async (tx) => {
        // Moving the exit later must not run into the next tenant.
        await assertPropertyFree(
          tx,
          context.organizationId,
          current.propertyId,
          { startDate: current.startDate, endDate: input.endDate },
          current.id
        )
        await tx
          .update(lease)
          .set({ endDate: input.endDate, terminatedAt })
          .where(and(eq(lease.id, current.id), isNull(lease.terminatedAt)))
      })

      return leaseBalance(
        { ...current, endDate: input.endDate, terminatedAt },
        current.paid,
        input.endDate
      )
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["leases"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(lease)
        .where(
          and(
            eq(lease.id, input.id),
            eq(lease.organizationId, context.organizationId),
            notExists(paymentsOf(lease.id))
          )
        )
        .returning({ id: lease.id })

      if (deleted.length > 0) return { success: true }

      await findLease(context.organizationId, input.id)
      throw new ORPCError("CONFLICT", {
        message: "Rent payments are recorded on this lease.",
        data: { code: "LEASE_HAS_PAYMENTS" },
      })
    }),

  addPayment: businessProcedure
    .route({ method: "POST", path: "/{leaseId}/payments", tags: ["leases"] })
    .input(
      z.object({
        leaseId: z.uuid(),
        amount: z.number().finite().positive().max(PROPERTY_LIMITS.rent),
        paidOn: day,
        note: z
          .string()
          .trim()
          .max(TENANT_LIMITS.paymentNote)
          .transform((value) => value || null),
      })
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      await findLease(context.organizationId, input.leaseId)

      const [created] = await db
        .insert(payment)
        .values(input)
        .returning({ id: payment.id })

      return { id: created!.id }
    }),

  /**
   * What a receipt for one payment prints: who paid whom, for what, and
   * where future rent goes (the landlord's bank details from its settings).
   */
  receipt: businessProcedure
    .route({ method: "GET", path: "/payments/{id}/receipt", tags: ["leases"] })
    .input(z.object({ id: z.uuid() }))
    .output(
      z.object({
        number: z.string(),
        amount: z.number(),
        paidOn: z.string(),
        note: z.string().nullable(),
        currency: z.enum(RENT_CURRENCIES),
        landlord: landlordSchema,
        tenant: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          address: z.string().nullable(),
        }),
        property: z.object({ name: z.string(), address: z.string() }),
      })
    )
    .handler(async ({ input, context }) => {
      const [row] = await db
        .select({ payment, lease, property, tenant: user })
        .from(payment)
        .innerJoin(lease, eq(lease.id, payment.leaseId))
        .innerJoin(property, eq(property.id, lease.propertyId))
        .innerJoin(user, eq(user.id, lease.tenantId))
        .where(
          and(
            eq(payment.id, input.id),
            eq(lease.organizationId, context.organizationId)
          )
        )
        .limit(1)

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Payment not found.",
          data: { code: "PAYMENT_NOT_FOUND" },
        })
      }

      return {
        // Stable and unique enough to quote: the year, then the payment's id.
        number: `${row.payment.paidOn.slice(0, 4)}-${row.payment.id.slice(0, 8).toUpperCase()}`,
        amount: row.payment.amount,
        paidOn: row.payment.paidOn,
        note: row.payment.note,
        currency: row.lease.currency,
        landlord: await findLandlord(context.organizationId),
        tenant: {
          id: row.tenant.id,
          name: row.tenant.name,
          email: row.tenant.email,
          address: readTenantMetadata(row.tenant.metadata).address,
        },
        property: { name: row.property.name, address: row.property.address },
      }
    }),

  removePayment: businessProcedure
    .route({ method: "DELETE", path: "/payments/{id}", tags: ["leases"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(payment)
        .where(
          and(
            eq(payment.id, input.id),
            exists(
              db
                .select({ one: sql`1` })
                .from(lease)
                .where(
                  and(
                    eq(lease.id, payment.leaseId),
                    eq(lease.organizationId, context.organizationId)
                  )
                )
            )
          )
        )
        .returning({ id: payment.id })

      if (deleted.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Payment not found." })
      }
      return { success: true }
    }),
})
