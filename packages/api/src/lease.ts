/*
 * Lease arithmetic shared by the API and the web app. Keep this file free of
 * server imports: it ends up in client bundles.
 *
 * Dates are calendar days as "YYYY-MM-DD" strings, the way Postgres `date`
 * columns arrive, so no time zone ever shifts an entry or exit by a day.
 */

export const NOTE_VISIBILITIES = ["private", "shared"] as const

export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number]

export const CUSTOMER_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  address: 300,
  relation: 60,
  contacts: 20,
  note: 4000,
  paymentNote: 300,
} as const

/** Longest lease length the forms accept: 99 years. */
export const MAX_TERM_MONTHS = 1188

export interface LeaseDates {
  startDate: string
  endDate: string | null
  /** Starts another term of `termMonths` each time one ends. */
  autoRenew?: boolean
  termMonths?: number | null
  terminatedAt?: Date | string | null
}

/** What the customer is billed each month, besides the one-off deposit. */
export interface LeaseCharges {
  rent: number
  charges?: number
  additionalCosts?: number
  discount?: number
}

/**
 * Whether the lease renews by itself: only one agreed for a number of months
 * does, and never once terminated.
 */
export function renewsAutomatically(lease: LeaseDates) {
  return Boolean(lease.autoRenew && lease.termMonths && !lease.terminatedAt)
}

/**
 * The day the customer moves out, as far as anyone knows: null while the lease
 * is open-ended or keeps renewing.
 */
export function effectiveEnd(lease: LeaseDates) {
  return renewsAutomatically(lease) ? null : lease.endDate
}

/** Rent, charges and costs, less the discount: never below zero. */
export function monthlyDue(lease: LeaseCharges) {
  const total =
    lease.rent +
    (lease.charges ?? 0) +
    (lease.additionalCosts ?? 0) -
    (lease.discount ?? 0)
  return Math.max(0, Math.round(total * 100) / 100)
}

/**
 * upcoming — the customer hasn't moved in yet (incoming)
 * active   — living there, with no exit date
 * ending   — living there, leaving on `endDate` (outgoing)
 * ended    — moved out (previous)
 */
export type LeaseStatus = "upcoming" | "active" | "ending" | "ended"

export function leaseStatus(lease: LeaseDates, today: string): LeaseStatus {
  const end = effectiveEnd(lease)
  if (lease.startDate > today) return "upcoming"
  if (end && end < today) return "ended"
  return end ? "ending" : "active"
}

/** Whether the lease still holds its property, now or later. */
export function isLeaseOpen(lease: LeaseDates, today: string) {
  return leaseStatus(lease, today) !== "ended"
}

export const CUSTOMER_GROUPS = [
  "current",
  "incoming",
  "outgoing",
  "previous",
] as const

export type CustomerGroup = (typeof CUSTOMER_GROUPS)[number]

/**
 * Which lists a customer appears in. One customer can be in several: someone
 * moving from one flat to another is both outgoing and incoming.
 */
export function customerGroups(
  leases: LeaseDates[],
  today: string
): Set<CustomerGroup> {
  const groups = new Set<CustomerGroup>()
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

function fromUtc(time: number) {
  return new Date(time).toISOString().slice(0, 10)
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

/** The last day of a lease agreed for `months` from `start`. */
export function termEndDate(start: string, months: number) {
  return fromUtc(addMonths(start, months) - DAY)
}

/**
 * The lease's length, when its dates span whole months: 12 for 1 Jan to
 * 31 Dec. Null when open-ended or a few days off.
 */
export function leaseMonths(lease: LeaseDates): number | null {
  if (lease.termMonths) return lease.termMonths
  if (!lease.endDate) return null
  const end = toUtc(lease.endDate)
  for (let months = 1; months <= MAX_TERM_MONTHS; months++) {
    const termEnd = addMonths(lease.startDate, months) - DAY
    if (termEnd === end) return months
    if (termEnd > end) return null
  }
  return null
}

/** Days from entry to exit, both included; null when open-ended. */
export function leaseDays(lease: LeaseDates): number | null {
  if (!lease.endDate) return null
  return (toUtc(lease.endDate) - toUtc(lease.startDate)) / DAY + 1
}

/**
 * When the term running on `today` ends: the next renewal of a lease that
 * renews by itself, else its exit date (null while open-ended).
 */
export function currentTermEnd(lease: LeaseDates, today: string) {
  if (!renewsAutomatically(lease)) return lease.endDate
  const months = lease.termMonths!
  const limit = toUtc(today)
  // Bounded like rentDue: renewals stop counting after 100 years.
  for (let term = 1; term * months <= 1200; term++) {
    const end = addMonths(lease.startDate, term * months) - DAY
    if (end >= limit) return fromUtc(end)
  }
  return lease.endDate
}

/** Today in the reader's own calendar, as "YYYY-MM-DD". */
export function localToday(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Rent charged on a lease by the end of `asOf`: the monthly bill (rent,
 * charges and costs, less the discount) is due in advance on the entry date
 * and every month after it; a final, partial month is charged by the day.
 * Pass the exit date as `asOf` for the lease's total.
 */
export function rentDue(
  lease: LeaseDates & LeaseCharges,
  asOf: string
): number {
  const monthly = monthlyDue(lease)
  if (monthly <= 0) return 0

  const limit = toUtc(asOf)
  const exit = effectiveEnd(lease)
  const end = exit ? toUtc(exit) : Number.POSITIVE_INFINITY
  let total = 0

  // Bounded so a nonsense date can't spin forever: 100 years of months.
  for (let month = 0; month < 1200; month++) {
    const periodStart = addMonths(lease.startDate, month)
    if (periodStart > limit || periodStart > end) break

    const nextPeriod = addMonths(lease.startDate, month + 1)
    if (end < nextPeriod - DAY) {
      const daysLived = (end - periodStart) / DAY + 1
      const daysInPeriod = (nextPeriod - periodStart) / DAY
      total += (monthly * daysLived) / daysInPeriod
      break
    }
    total += monthly
  }

  return Math.round(total * 100) / 100
}

/**
 * What the customer still owes on a lease (negative: what they overpaid). A
 * terminated lease is settled against everything it ever charged; an open
 * one against what's been charged so far.
 */
export function leaseBalance(
  lease: LeaseDates & LeaseCharges & { terminatedAt: Date | string | null },
  paid: number,
  today: string
) {
  const asOf = lease.terminatedAt && lease.endDate ? lease.endDate : today
  const due = rentDue(lease, asOf)
  return { due, paid, balance: Math.round((due - paid) * 100) / 100 }
}

/**
 * The next day rent falls due after `today`: the next monthly anniversary of
 * the entry date, while the lease still runs then. Null once it has ended.
 */
export function nextRentDate(lease: LeaseDates, today: string) {
  const limit = toUtc(today)
  const exit = effectiveEnd(lease)
  const end = exit ? toUtc(exit) : Number.POSITIVE_INFINITY
  // Bounded like rentDue: 100 years of months.
  for (let month = 0; month < 1200; month++) {
    const due = addMonths(lease.startDate, month)
    if (due > end) return null
    if (due > limit) return fromUtc(due)
  }
  return null
}

/** Whole days from `from` to `to` ("YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY)
}

/** `day` moved `days` ahead (or back, when negative). */
export function addDays(day: string, days: number) {
  return fromUtc(toUtc(day) + days * DAY)
}

/** One month of a lease, as billed: a final, partial one is a `ratio` of it. */
export interface BillingPeriod {
  start: string
  end: string
  /** 1 for a whole month; the share of it lived in for a partial last one. */
  ratio: number
}

/**
 * The months of a lease that have begun by `through`, in order, the way
 * `rentDue` charges them: each from a monthly anniversary of the entry date,
 * the last cut short at the exit date.
 */
export function billingPeriods(
  lease: LeaseDates,
  through: string
): BillingPeriod[] {
  const limit = toUtc(through)
  const exit = effectiveEnd(lease)
  const end = exit ? toUtc(exit) : Number.POSITIVE_INFINITY
  const periods: BillingPeriod[] = []

  // Bounded like rentDue: 100 years of months.
  for (let month = 0; month < 1200; month++) {
    const periodStart = addMonths(lease.startDate, month)
    if (periodStart > limit || periodStart > end) break

    const nextPeriod = addMonths(lease.startDate, month + 1)
    if (end < nextPeriod - DAY) {
      const daysLived = (end - periodStart) / DAY + 1
      const daysInPeriod = (nextPeriod - periodStart) / DAY
      periods.push({
        start: fromUtc(periodStart),
        end: fromUtc(end),
        ratio: daysLived / daysInPeriod,
      })
      break
    }
    periods.push({
      start: fromUtc(periodStart),
      end: fromUtc(nextPeriod - DAY),
      ratio: 1,
    })
  }

  return periods
}
