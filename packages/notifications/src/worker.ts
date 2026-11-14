import { deleteExpiredNotifications } from "./cleanup"
import { deliverNotificationEmail } from "./email-job"
import { stopListening } from "./live"
import {
  NOTIFICATION_CLEANUP_QUEUE,
  NOTIFICATION_EMAIL_QUEUE,
  queue,
  stopQueue,
} from "./queue"
import type { NotificationEmailJob } from "./types"

/** Old notifications are deleted daily, at this time in Romania. */
const CLEANUP_CRON = "0 3 * * *"
const CLEANUP_TIME_ZONE = "Europe/Bucharest"

/**
 * Works the notification jobs in this process: sends the queued emails and
 * runs the daily cleanup. Safe on several servers at once: each job goes to
 * one of them.
 */
export async function startNotificationWorker() {
  const boss = await queue()

  await boss.work<NotificationEmailJob>(
    NOTIFICATION_EMAIL_QUEUE,
    async (jobs) => {
      for (const job of jobs) await deliverNotificationEmail(job.data)
    }
  )

  await boss.schedule(NOTIFICATION_CLEANUP_QUEUE, CLEANUP_CRON, null, {
    tz: CLEANUP_TIME_ZONE,
  })
  await boss.work(NOTIFICATION_CLEANUP_QUEUE, async () => {
    const deleted = await deleteExpiredNotifications()
    if (deleted > 0) console.log(`Deleted ${deleted} old notification(s).`)
  })
}

/**
 * Stops everything notifications run in this process (the job queue and the
 * live listener), letting jobs in progress finish.
 */
export async function stopNotifications() {
  await Promise.all([stopQueue(), stopListening()])
}
