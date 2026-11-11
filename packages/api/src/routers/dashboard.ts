import { db } from "@workspace/db"
import {
  customerDocument,
  invoice,
  lease,
  payment,
  property,
  user,
} from "@workspace/db/schema"
import { and, asc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import {
  addDays,
  currentTermEnd,
  daysBetween,
  leaseStatus,
  localToday,
  monthlyDue,
  nextRentDate,
  rentDue,
  renewsAutomatically,
} from "../lease"
import { PROPERTY_TYPES, RENT_CURRENCIES } from "../property"

/** How far ahead the renewals list looks. */
const RENEWAL_WINDOW_DAYS = 90
/** Paid up, but rent falls due again within this many days. */
const DUE_SOON_DAYS = 7
/** Move-ins this close get a task to prepare them. */
const MOVE_IN_WINDOW_DAYS = 14
/** Fixed-term leases ending this close need a decision. */
const DECISION_WINDOW_DAYS = 30

const currency = z.enum(RENT_CURRENCIES)
type Currency = z.infer<typeof currency>

const money = z.object({ currency, amount: z.number() })
const person = z.object({ id: z.string(), name: z.string() })
const place = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(PROPERTY_TYPES),
})

const RENT_STATUSES = ["overdue", "due", "paid"] as const
const TASK_KINDS = [
  "collectRent",
  "decideRenewal",
  "reviewRenewal",
  "prepareMoveIn",
  "addContract",
  "findCustomer",
] as const
const PRIORITIES = ["high", "medium", "low"] as const

const overviewSchema = z.object({
  today: z.string(),
  occupancy: z.object({
    total: z.number(),
    occupied: z.number(),
    vacant: z.number(),
    /** Vacant today, but a lease starts later. */
    incoming: z.number(),
    byType: z.array(
      z.object({
        type: z.enum(PROPERTY_TYPES),
        total: z.number(),
        occupied: z.number(),
      })
    ),
  }),
  rent: z.object({
    /** Charged on leases for days in the reader's current month. */
    billed: z.array(money),
    /** Payments dated in the current month. */
    collected: z.array(money),
    /** Charged so far and not paid, on every lease. */
    outstanding: z.array(money),
    counts: z.object({
      overdue: z.number(),
      due: z.number(),
      paid: z.number(),
    }),
    /** Overdue first, largest debt first; then due soonest. */
    leases: z.array(
      z.object({
        leaseId: z.string(),
        customer: person,
        property: place,
        currency,
        monthly: z.number(),
        balance: z.number(),
        status: z.enum(RENT_STATUSES),
        nextDue: z.string().nullable(),
      })
    ),
  }),
  /** Current leases whose term ends within the window, soonest first. */
  renewals: z.array(
    z.object({
      leaseId: z.string(),
      customer: person,
      property: place,
      date: z.string(),
      daysLeft: z.number(),
      /** Renews by itself on `date`, or the customer leaves then. */
      kind: z.enum(["renews", "ends"]),
      /** Someone else's lease on the property starts after this one. */
      followedBy: person.nullable(),
      monthly: z.number(),
      currency,
    })
  ),
  /** Worked out from the records: they go away once dealt with. */
  tasks: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(TASK_KINDS),
      priority: z.enum(PRIORITIES),
      date: z.string().nullable(),
      customer: person.nullable(),
      property: place,
      amount: money.nullable(),
    })
  ),
})

type Overview = z.infer<typeof overviewSchema>
type Task = Overview["tasks"][number]

/** Adds `amount` to its currency's total, keeping currencies apart. */
function tally(totals: Map<Currency, number>, cur: Currency, amount: number) {
  if (amount === 0) return
  totals.set(cur, (totals.get(cur) ?? 0) + amount)
}

function toMoney(totals: Map<Currency, number>) {
  return RENT_CURRENCIES.filter((cur) => totals.has(cur)).map((cur) => ({
    currency: cur,
    amount: Math.round(totals.get(cur)! * 100) / 100,
  }))
}

function monthBounds(today: string) {
  const [year, month] = today.split("-").map(Number)
  const start = `${today.slice(0, 7)}-01`
  const last = new Date(Date.UTC(year!, month!, 0)).getUTCDate()
  return { start, end: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` }
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

/**
 * What a business sees first: how full its properties are, where rent stands,
 * which leases are coming up for renewal, and what needs doing.
 */
export const dashboardRouter = o.prefix("/dashboard").router({
  overview: businessProcedure
    .route({ method: "GET", path: "/overview", tags: ["dashboard"] })
    .input(z.object({ today: z.iso.date().optional() }))
    .output(overviewSchema)
    .handler(async ({ input, context }) => {
      const today = input.today ?? localToday()
      const org = context.organizationId
      const month = monthBounds(today)

      const paidOn = db
        .select({
          invoiceId: payment.invoiceId,
          total: sql<string>`sum(${payment.amount})`.as("total"),
        })
        .from(payment)
        .groupBy(payment.invoiceId)
        .as("paid_on")

      const [properties, leaseRows, documented, monthPayments, invoiceRows] =
        await Promise.all([
          db
            .select({
              id: property.id,
              name: property.name,
              type: property.type,
            })
            .from(property)
            .where(eq(property.organizationId, org))
            .orderBy(asc(property.name)),
          db
            .select({
              lease,
              customer: { id: user.id, name: user.name },
            })
            .from(lease)
            .innerJoin(user, eq(user.id, lease.customerId))
            .where(eq(lease.organizationId, org))
            .orderBy(asc(lease.startDate)),
          db
            .selectDistinct({ leaseId: customerDocument.leaseId })
            .from(customerDocument)
            .where(
              and(
                eq(customerDocument.organizationId, org),
                isNotNull(customerDocument.leaseId)
              )
            ),
          db
            .select({
              currency: lease.currency,
              total: sql<string>`sum(${payment.amount})`,
            })
            .from(payment)
            .innerJoin(lease, eq(lease.id, payment.leaseId))
            .where(
              and(
                eq(lease.organizationId, org),
                gte(payment.paidOn, month.start),
                lte(payment.paidOn, month.end)
              )
            )
            .groupBy(lease.currency),
          // Live invoices with what's been paid on each.
          db
            .select({
              leaseId: invoice.leaseId,
              total: invoice.total,
              dueOn: invoice.dueOn,
              paid: paidOn.total,
            })
            .from(invoice)
            .leftJoin(paidOn, eq(paidOn.invoiceId, invoice.id))
            .where(
              and(eq(invoice.organizationId, org), isNull(invoice.voidedAt))
            ),
        ])

      /** What's still owed on each lease's invoices, and how much is late. */
      const owed = new Map<string, { balance: number; late: number }>()
      for (const row of invoiceRows) {
        const left = Math.max(0, row.total - Number(row.paid ?? 0))
        if (left <= 0) continue
        const entry = owed.get(row.leaseId) ?? { balance: 0, late: 0 }
        entry.balance += left
        if (row.dueOn < today) entry.late += left
        owed.set(row.leaseId, entry)
      }

      const places = new Map(properties.map((p) => [p.id, p]))
      const withDocuments = new Set(documented.map((d) => d.leaseId))
      const leases = leaseRows
        .filter((row) => places.has(row.lease.propertyId))
        .map((row) => ({
          ...row.lease,
          customer: row.customer,
          property: places.get(row.lease.propertyId)!,
          status: leaseStatus(row.lease, today),
        }))
      type Lease = (typeof leases)[number]

      // --- Occupancy ---------------------------------------------------------
      const current = leases.filter(
        (l) => l.status === "active" || l.status === "ending"
      )
      const upcoming = leases.filter((l) => l.status === "upcoming")
      const occupied = new Set(current.map((l) => l.propertyId))
      const incoming = new Set(
        upcoming.map((l) => l.propertyId).filter((id) => !occupied.has(id))
      )
      const byType = PROPERTY_TYPES.map((type) => {
        const ofType = properties.filter((p) => p.type === type)
        return {
          type,
          total: ofType.length,
          occupied: ofType.filter((p) => occupied.has(p.id)).length,
        }
      }).filter((row) => row.total > 0)

      // --- Rent --------------------------------------------------------------
      const billed = new Map<Currency, number>()
      const outstanding = new Map<Currency, number>()
      const collected = new Map<Currency, number>()
      for (const row of monthPayments) {
        tally(collected, row.currency, Number(row.total ?? 0))
      }

      const rentRows: Overview["rent"]["leases"] = []
      for (const l of leases) {
        tally(
          billed,
          l.currency,
          rentDue(l, month.end) - rentDue(l, addDays(month.start, -1))
        )
        const { balance: unrounded, late } = owed.get(l.id) ?? {
          balance: 0,
          late: 0,
        }
        const balance = Math.round(unrounded * 100) / 100
        // An upcoming lease shows up once its first invoice is out.
        if (l.status === "upcoming" && balance <= 0) continue

        const isCurrent = l.status === "active" || l.status === "ending"
        // Past leases only matter while something is still owed on them.
        if (!isCurrent && l.status !== "upcoming" && balance <= 0) continue
        if (balance > 0) tally(outstanding, l.currency, balance)

        const nextDue = isCurrent ? nextRentDate(l, today) : null
        // Overdue once an invoice is past its due date; due while one is
        // open or the next rent date is close.
        const status =
          late > 0
            ? "overdue"
            : balance > 0 ||
                (nextDue && daysBetween(today, nextDue) <= DUE_SOON_DAYS)
              ? "due"
              : "paid"

        rentRows.push({
          leaseId: l.id,
          customer: l.customer,
          property: l.property,
          currency: l.currency,
          monthly: monthlyDue(l),
          balance,
          status,
          nextDue,
        })
      }
      const statusRank = { overdue: 0, due: 1, paid: 2 } as const
      rentRows.sort(
        (a, b) =>
          statusRank[a.status] - statusRank[b.status] ||
          (a.status === "overdue"
            ? b.balance - a.balance
            : (a.nextDue ?? "9").localeCompare(b.nextDue ?? "9"))
      )

      // --- Renewals ----------------------------------------------------------
      /** The next lease on `l`'s property, starting after it ends. */
      const successor = (l: Lease, end: string) =>
        leases.find(
          (other) =>
            other.id !== l.id &&
            other.propertyId === l.propertyId &&
            other.startDate > end
        ) ?? null

      const renewals: Overview["renewals"] = []
      for (const l of current) {
        const end = currentTermEnd(l, today)
        if (!end) continue
        const daysLeft = daysBetween(today, end)
        if (daysLeft < 0 || daysLeft > RENEWAL_WINDOW_DAYS) continue
        const next = successor(l, end)
        renewals.push({
          leaseId: l.id,
          customer: l.customer,
          property: l.property,
          date: end,
          daysLeft,
          kind: renewsAutomatically(l) ? "renews" : "ends",
          followedBy:
            next && next.customerId !== l.customerId ? next.customer : null,
          monthly: monthlyDue(l),
          currency: l.currency,
        })
      }
      renewals.sort((a, b) => a.daysLeft - b.daysLeft)

      // --- Tasks -------------------------------------------------------------
      const tasks: Task[] = []

      for (const row of rentRows) {
        if (row.status !== "overdue") continue
        tasks.push({
          id: `rent-${row.leaseId}`,
          kind: "collectRent",
          // A month or more behind is urgent; part of one can wait a little.
          priority:
            row.monthly > 0 && row.balance < row.monthly ? "medium" : "high",
          date: null,
          customer: row.customer,
          property: row.property,
          amount: { currency: row.currency, amount: row.balance },
        })
      }

      for (const r of renewals) {
        const l = leases.find((x) => x.id === r.leaseId)!
        if (r.kind === "ends") {
          // Already settled: someone (or the same customer) takes over after.
          if (successor(l, r.date)) continue
          if (r.daysLeft > DECISION_WINDOW_DAYS) continue
          tasks.push({
            id: `renew-${r.leaseId}`,
            kind: "decideRenewal",
            priority: r.daysLeft <= 14 ? "high" : "medium",
            date: r.date,
            customer: r.customer,
            property: r.property,
            amount: null,
          })
        } else if (r.daysLeft <= DECISION_WINDOW_DAYS) {
          tasks.push({
            id: `review-${r.leaseId}`,
            kind: "reviewRenewal",
            priority: "low",
            date: r.date,
            customer: r.customer,
            property: r.property,
            amount: null,
          })
        }
      }

      for (const l of upcoming) {
        if (daysBetween(today, l.startDate) > MOVE_IN_WINDOW_DAYS) continue
        tasks.push({
          id: `move-in-${l.id}`,
          kind: "prepareMoveIn",
          priority: "medium",
          date: l.startDate,
          customer: l.customer,
          property: l.property,
          amount: null,
        })
      }

      for (const l of [...current, ...upcoming]) {
        if (withDocuments.has(l.id)) continue
        tasks.push({
          id: `contract-${l.id}`,
          kind: "addContract",
          priority: l.status === "upcoming" ? "medium" : "low",
          date: null,
          customer: l.customer,
          property: l.property,
          amount: null,
        })
      }

      for (const p of properties) {
        if (occupied.has(p.id) || incoming.has(p.id)) continue
        tasks.push({
          id: `vacant-${p.id}`,
          kind: "findCustomer",
          priority: "low",
          date: null,
          customer: null,
          property: p,
          amount: null,
        })
      }

      tasks.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.date ?? "9").localeCompare(b.date ?? "9")
      )

      return {
        today,
        occupancy: {
          total: properties.length,
          occupied: occupied.size,
          vacant: properties.length - occupied.size,
          incoming: incoming.size,
          byType,
        },
        rent: {
          billed: toMoney(billed),
          collected: toMoney(collected),
          outstanding: toMoney(outstanding),
          counts: {
            overdue: rentRows.filter((r) => r.status === "overdue").length,
            due: rentRows.filter((r) => r.status === "due").length,
            paid: rentRows.filter((r) => r.status === "paid").length,
          },
          leases: rentRows,
        },
        renewals,
        tasks,
      }
    }),
})
