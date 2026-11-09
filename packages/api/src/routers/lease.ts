import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { lease, payment, property } from "@workspace/db/schema"
import {
  and,
  eq,
  exists,
  gte,
  isNull,
  lte,
  ne,
  notExists,
  or,
  sql,
  sum,
} from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { leaseBalance, TENANT_LIMITS } from "../lease"
import { findTenant } from "../lib/tenant"
import { PROPERTY_LIMITS, RENT_CURRENCIES } from "../property"

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const day = z.iso.date()

const terms = z.object({
  startDate: day,
  endDate: day.nullable(),
  rent: z.number().finite().nonnegative().max(PROPERTY_LIMITS.rent),
  currency: z.enum(RENT_CURRENCIES),
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
    .select({ id: property.id })
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
        or(isNull(lease.endDate), gte(lease.endDate, dates.startDate))
      )
    )
    .limit(1)

  if (clash) {
    throw new ORPCError("CONFLICT", {
      message: "Another lease already covers those dates for this property.",
      data: { code: "LEASE_OVERLAP" },
    })
  }
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
 * it. Scoped to `context.organizationId` like every business procedure.
 */
export const leaseRouter = o.prefix("/leases").router({
  create: businessProcedure
    .route({ method: "POST", path: "/", tags: ["leases"] })
    .input(
      terms
        .extend({ tenantId: z.uuid(), propertyId: z.uuid() })
        .refine(...exitAfterEntry)
    )
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      await findTenant(context.organizationId, input.tenantId)

      const id = await db.transaction(async (tx) => {
        await assertPropertyFree(
          tx,
          context.organizationId,
          input.propertyId,
          input
        )
        const [created] = await tx
          .insert(lease)
          .values({ ...input, organizationId: context.organizationId })
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
      const { id, ...values } = input
      const current = await findLease(context.organizationId, id)
      assertNotTerminated(current)

      await db.transaction(async (tx) => {
        await assertPropertyFree(
          tx,
          context.organizationId,
          current.propertyId,
          values,
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
