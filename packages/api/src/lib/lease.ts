import { lease } from "@workspace/db/schema"
import { and, eq, gte, isNull, or, type SQL } from "drizzle-orm"

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
