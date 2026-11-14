import { db } from "@workspace/db"
import { notification } from "@workspace/db/schema"
import { lt, or } from "drizzle-orm"

/** Notifications are kept this long… */
export const RETENTION_DAYS = 90

/** …or this long once archived. */
export const ARCHIVED_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Deletes notifications past their retention, as of `now`; returns how many. */
export async function deleteExpiredNotifications(now = new Date()) {
  const result = await db
    .delete(notification)
    .where(
      or(
        lt(
          notification.createdAt,
          new Date(now.getTime() - RETENTION_DAYS * DAY_MS)
        ),
        lt(
          notification.archivedAt,
          new Date(now.getTime() - ARCHIVED_RETENTION_DAYS * DAY_MS)
        )
      )
    )
  return result.rowCount ?? 0
}
