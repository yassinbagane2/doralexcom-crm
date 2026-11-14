import { sendEmail } from "@workspace/auth/email"
import { db } from "@workspace/db"
import { notification, user } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

import { renderEmail } from "./emails"
import { enabledChannels } from "./preferences"
import { notificationLocale, type NotificationEmailJob } from "./types"

/**
 * Sends one notification email, in the recipient's language. Checks again
 * at send time, since things may have changed since it was queued: nothing
 * goes out once the account is gone, email is turned off for the type, or
 * the notification was already read in the app (a retry can come minutes
 * later). Throws when sending fails, so the queue retries it.
 *
 * @returns whether an email was sent.
 */
export async function deliverNotificationEmail(job: NotificationEmailJob) {
  const recipient = await db.query.user.findFirst({
    where: eq(user.id, job.userId),
    columns: { email: true, locale: true },
  })
  if (!recipient) return false

  const channels = await enabledChannels(job.type, [job.userId])
  if (!channels.get(job.userId)?.email) return false

  if (job.notificationId) {
    const sent = await db.query.notification.findFirst({
      where: eq(notification.id, job.notificationId),
      columns: { readAt: true },
    })
    if (sent?.readAt) return false
  }

  await sendEmail({
    to: recipient.email,
    ...renderEmail(job.type, job.payload, notificationLocale(recipient.locale)),
  })
  return true
}
