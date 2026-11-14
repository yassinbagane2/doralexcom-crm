import { env } from "@workspace/db/env"
import { PgBoss } from "pg-boss"

/*
 * Background jobs, kept in the app's Postgres by pg-boss, in its own
 * `pgboss` schema (created on first start, outside the Drizzle migrations).
 */

/** Notification emails waiting to be sent, one job per recipient. */
export const NOTIFICATION_EMAIL_QUEUE = "notification-email"

/** The daily deletion of old notifications. */
export const NOTIFICATION_CLEANUP_QUEUE = "notification-cleanup"

let started: Promise<PgBoss> | undefined

async function start() {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
    max: 4,
  })
  // An 'error' event nobody listens to would crash the process.
  boss.on("error", (error) => console.error("[queue]", error))
  await boss.start()
  // Retried after 30s, 1m, 2m… as the email service recovers.
  await boss.createQueue(NOTIFICATION_EMAIL_QUEUE, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
  })
  await boss.createQueue(NOTIFICATION_CLEANUP_QUEUE)
  return boss
}

/** The started job queue, shared by everything in this process. */
export function queue() {
  started ??= start().catch((error: unknown) => {
    // Let the next call try again rather than keep the failure.
    started = undefined
    throw error
  })
  return started
}

/** Stops the queue, if it was started, letting active jobs finish. */
export async function stopQueue() {
  const boss = await started?.catch(() => undefined)
  started = undefined
  await boss?.stop()
}
