import { lease } from "@workspace/db/schema"
import {
  and,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm"

import type { CustomerGroup } from "../lease"

/**
 * Leases still holding their property after `day`: open-ended, leaving on or
 * after it, or renewing by themselves (see `renewsAutomatically`).
 */
export function holdsPropertyOn(day: SQL | string) {
  return or(
    isNull(lease.endDate),
    gte(lease.endDate, day),
    and(eq(lease.autoRenew, true), isNull(lease.terminatedAt))
  )
}

/**
 * `effectiveEnd` in SQL: the exit date, or null while the lease is open-ended
 * or keeps renewing. Mirrors `renewsAutomatically` in ../lease.
 */
const effectiveEnd = sql`(case when ${lease.autoRenew} and coalesce(${lease.termMonths}, 0) <> 0 and ${lease.terminatedAt} is null then null else ${lease.endDate} end)`

/*
 * `leaseStatus` in SQL, for a reader whose day is `today` ("YYYY-MM-DD").
 * Lists filter and count by these so they agree with what each row shows.
 */

export const leaseUpcoming = (today: string): SQL => gt(lease.startDate, today)

/** Living there: `active` or `ending`. */
export const leaseCurrent = (today: string): SQL =>
  and(
    lte(lease.startDate, today),
    or(isNull(effectiveEnd), gte(effectiveEnd, today))
  )!

export const leaseEnding = (today: string): SQL =>
  and(
    lte(lease.startDate, today),
    isNotNull(effectiveEnd),
    gte(effectiveEnd, today)
  )!

export const leaseEnded = (today: string): SQL =>
  and(
    lte(lease.startDate, today),
    isNotNull(effectiveEnd),
    lt(effectiveEnd, today)
  )!

/**
 * `customerGroups` in SQL: whether the customer whose id is `customerId` has
 * leases putting them in `group`.
 */
export function customerInGroup(
  group: CustomerGroup,
  customerId: SQLWrapper,
  today: string
) {
  const leasesWhere = (where?: SQL) =>
    sql`exists (select 1 from ${lease} where ${lease.customerId} = ${customerId}${where ? sql` and ${where}` : sql``})`

  switch (group) {
    case "current":
      return leasesWhere(leaseCurrent(today))
    case "incoming":
      return leasesWhere(leaseUpcoming(today))
    case "outgoing":
      return leasesWhere(leaseEnding(today))
    case "previous":
      // Has leases, and every one of them has ended.
      return sql`(${leasesWhere()} and not ${leasesWhere(sql`not ${leaseEnded(today)}`)})`
  }
}

/** A `LIKE` pattern matching `text` anywhere, its wildcards taken literally. */
export function containing(text: string) {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`
}
