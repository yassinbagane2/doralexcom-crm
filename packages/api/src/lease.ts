/*
 * Lease arithmetic shared by the API and the web app. Keep this file free of
 * server imports: it ends up in client bundles.
 *
 * Dates are calendar days as "YYYY-MM-DD" strings, the way Postgres `date`
 * columns arrive, so no time zone ever shifts an entry or exit by a day.
 */

export const NOTE_VISIBILITIES = ["private", "shared"] as const

export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number]

export const TENANT_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  address: 300,
  relation: 60,
  contacts: 20,
  note: 4000,
  paymentNote: 300,
} as const

export interface LeaseDates {
  startDate: string
  endDate: string | null
}

/**
 * upcoming — the tenant hasn't moved in yet (incoming)
 * active   — living there, with no exit date
 * ending   — living there, leaving on `endDate` (outgoing)
 * ended    — moved out (previous)
 */
export type LeaseStatus = "upcoming" | "active" | "ending" | "ended"

export function leaseStatus(lease: LeaseDates, today: string): LeaseStatus {
  if (lease.startDate > today) return "upcoming"
  if (lease.endDate && lease.endDate < today) return "ended"
  return lease.endDate ? "ending" : "active"
}

/** Whether the lease still holds its property, now or later. */
export function isLeaseOpen(lease: LeaseDates, today: string) {
  return leaseStatus(lease, today) !== "ended"
}

export const TENANT_GROUPS = [
  "current",
  "incoming",
  "outgoing",
  "previous",
] as const

export type TenantGroup = (typeof TENANT_GROUPS)[number]

/**
 * Which lists a tenant appears in. One tenant can be in several: someone
 * moving from one flat to another is both outgoing and incoming.
 */
export function tenantGroups(
  leases: LeaseDates[],
  today: string
): Set<TenantGroup> {
  const groups = new Set<TenantGroup>()
  const statuses = leases.map((lease) => leaseStatus(lease, today))

  if (statuses.some((s) => s === "active" || s === "ending")) {
    groups.add("current")
  }
  if (statuses.includes("upcoming")) groups.add("incoming")
  if (statuses.includes("ending")) groups.add("outgoing")
  if (statuses.length > 0 && statuses.every((s) => s === "ended")) {
    groups.add("previous")
  }

  return groups
}

const DAY = 24 * 60 * 60 * 1000

function toUtc(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  return Date.UTC(year!, month! - 1, date!)
}

/** `start` moved `months` ahead, on the same day of the month (or its last). */
function addMonths(start: string, months: number) {
  const [year, month, date] = start.split("-").map(Number)
  const first = new Date(Date.UTC(year!, month! - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
  ).getUTCDate()
  return Date.UTC(
    first.getUTCFullYear(),
    first.getUTCMonth(),
    Math.min(date!, lastDay)
  )
}

/** Today in the reader's own calendar, as "YYYY-MM-DD". */
export function localToday(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Rent charged on a lease by the end of `asOf`. Rent is due in advance on
 * the entry date and every month after it; a final, partial month is charged
 * by the day. Pass the exit date as `asOf` for the lease's total.
 */
export function rentDue(
  lease: LeaseDates & { rent: number },
  asOf: string
): number {
  if (lease.rent <= 0) return 0

  const limit = toUtc(asOf)
  const end = lease.endDate ? toUtc(lease.endDate) : Number.POSITIVE_INFINITY
  let total = 0

  // Bounded so a nonsense date can't spin forever: 100 years of months.
  for (let month = 0; month < 1200; month++) {
    const periodStart = addMonths(lease.startDate, month)
    if (periodStart > limit || periodStart > end) break

    const nextPeriod = addMonths(lease.startDate, month + 1)
    if (end < nextPeriod - DAY) {
      const daysLived = (end - periodStart) / DAY + 1
      const daysInPeriod = (nextPeriod - periodStart) / DAY
      total += (lease.rent * daysLived) / daysInPeriod
      break
    }
    total += lease.rent
  }

  return Math.round(total * 100) / 100
}

/**
 * What the tenant still owes on a lease (negative: what they overpaid). A
 * terminated lease is settled against everything it ever charged; an open
 * one against what's been charged so far.
 */
export function leaseBalance(
  lease: LeaseDates & { rent: number; terminatedAt: Date | string | null },
  paid: number,
  today: string
) {
  const asOf = lease.terminatedAt && lease.endDate ? lease.endDate : today
  const due = rentDue(lease, asOf)
  return { due, paid, balance: Math.round((due - paid) * 100) / 100 }
}
