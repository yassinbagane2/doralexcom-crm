import { createHash } from "node:crypto"

import { db } from "@workspace/db"
import { notification } from "@workspace/db/schema"
import { sql } from "drizzle-orm"

import { NOTIFICATIONS_CHANNEL } from "./live"
import { enabledChannels } from "./preferences"
import { NOTIFICATION_EMAIL_QUEUE, queue } from "./queue"
import {
  NOTIFICATION_TYPES,
  type NotificationEmailJob,
  type NotificationPayload,
  type NotificationType,
} from "./types"

/**
 * Notifies one or more users (by user id) of `type`. Each recipient gets it
 * on the channels they haven't turned off: a row in their in-app feed, which
 * their open streams hear about at once (see live.ts), and an email job.
 *
 * Retry-safe with a `transactionId`: a recipient who already has a
 * notification with that id gets no second row and no second email.
 */
export async function notify<T extends NotificationType>(
  type: T,
  to: string | string[],
  payload: NotificationPayload<T>,
  options: {
    /** Deduplicates retries, per recipient. */
    transactionId?: string
    /** The business the notification is about, when there is one. */
    organizationId?: string
  } = {}
) {
  const recipients = [...new Set(Array.isArray(to) ? to : [to])]
  if (recipients.length === 0) return

  const data = NOTIFICATION_TYPES[type].payload.parse(
    payload
  ) as NotificationPayload<T>
  const { transactionId, organizationId = null } = options
  const channels = await enabledChannels(type, recipients)

  const inApp = recipients.filter((userId) => channels.get(userId)!.in_app)
  const created = new Map<string, string>()
  if (inApp.length > 0) {
    await db.transaction(async (tx) => {
      const rows = await tx
        .insert(notification)
        .values(
          inApp.map((userId) => ({
            userId,
            organizationId,
            type,
            payload: data,
            transactionId,
          }))
        )
        .onConflictDoNothing({
          target: [notification.userId, notification.transactionId],
        })
        .returning({ id: notification.id, userId: notification.userId })
      if (rows.length === 0) return

      // Delivered when the transaction commits, so a listener that hears it
      // always finds the row.
      const userIds = sql.join(
        rows.map((row) => sql`${row.userId}`),
        sql`, `
      )
      await tx.execute(
        sql`select pg_notify(${NOTIFICATIONS_CHANNEL}, user_id) from unnest(array[${userIds}]::text[]) as user_id`
      )
      for (const row of rows) created.set(row.userId, row.id)
    })
  }

  // After the commit: a retry after a failure here finds the rows already
  // there but still queues the emails, which the job id keeps to one each.
  const byEmail = recipients.filter((userId) => channels.get(userId)!.email)
  if (byEmail.length > 0) {
    const boss = await queue()
    await Promise.all(
      byEmail.map((userId) => {
        const job: NotificationEmailJob<T> = {
          type,
          userId,
          organizationId,
          payload: data,
          notificationId: created.get(userId) ?? null,
        }
        return boss.send(NOTIFICATION_EMAIL_QUEUE, job, {
          ...(transactionId
            ? { id: stableUuid(type, userId, transactionId) }
            : {}),
        })
      })
    )
  }
}

/** The same UUID every time for the same parts (job ids must be UUIDs). */
function stableUuid(...parts: string[]) {
  const hex = createHash("sha256").update(parts.join("\0")).digest("hex")
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-")
}
