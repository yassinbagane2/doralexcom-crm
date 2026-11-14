import { db } from "@workspace/db"
import { notification } from "@workspace/db/schema"
import { createUser, resetDatabase } from "@workspace/db/test"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { notify } from "./notify"
import { savePreference } from "./preferences"
import { NOTIFICATION_EMAIL_QUEUE, queue } from "./queue"
import { stopNotifications } from "./worker"

const payload = {
  conversationId: "6f1c2d3e-4b5a-4c6d-8e7f-901234567890",
  senderName: "Ana Popescu",
  organizationName: "Acme Rentals",
  preview: "Hello!",
  path: "/inbox",
  link: "http://localhost:3000/inbox",
}

/** The email jobs queued for `userId`. */
async function emailJobs(userId: string) {
  const { rows } = await db.execute(
    sql`select id from pgboss.job where name = ${NOTIFICATION_EMAIL_QUEUE} and data->>'userId' = ${userId}`
  )
  return rows
}

function notificationsOf(userId: string) {
  return db.select().from(notification).where(eq(notification.userId, userId))
}

beforeAll(async () => {
  await queue()
})

beforeEach(async () => {
  await resetDatabase()
  await db.execute(
    sql`delete from pgboss.job where name = ${NOTIFICATION_EMAIL_QUEUE}`
  )
})

afterAll(async () => {
  await stopNotifications()
  await db.$client.end()
})

describe("notify()", () => {
  it("adds one notification and one email per recipient", async () => {
    const [ana, ion] = [await createUser(), await createUser()]

    await notify("new-message", [ana.id, ion.id, ana.id], payload)

    expect(await notificationsOf(ana.id)).toHaveLength(1)
    expect(await notificationsOf(ion.id)).toHaveLength(1)
    expect(await emailJobs(ana.id)).toHaveLength(1)
    expect(await emailJobs(ion.id)).toHaveLength(1)
  })

  it("adds nothing more when retried with the same transactionId", async () => {
    const ana = await createUser()

    await notify("new-message", ana.id, payload, { transactionId: "message-1" })
    await notify("new-message", ana.id, payload, { transactionId: "message-1" })

    expect(await notificationsOf(ana.id)).toHaveLength(1)
    expect(await emailJobs(ana.id)).toHaveLength(1)
  })

  it("treats each transactionId, and each recipient, separately", async () => {
    const [ana, ion] = [await createUser(), await createUser()]

    await notify("new-message", ana.id, payload, { transactionId: "message-1" })
    await notify("new-message", [ana.id, ion.id], payload, {
      transactionId: "message-2",
    })
    await notify("new-message", ion.id, payload, { transactionId: "message-1" })

    expect(await notificationsOf(ana.id)).toHaveLength(2)
    expect(await notificationsOf(ion.id)).toHaveLength(2)
  })

  it("skips the in-app notification for someone who turned it off", async () => {
    const ana = await createUser()
    await savePreference(ana.id, "new-message", "in_app", false)

    await notify("new-message", ana.id, payload)

    expect(await notificationsOf(ana.id)).toHaveLength(0)
    expect(await emailJobs(ana.id)).toHaveLength(1)
  })

  it("queues no email for someone who turned email off", async () => {
    const [ana, ion] = [await createUser(), await createUser()]
    await savePreference(ana.id, "new-message", "email", false)

    await notify("new-message", [ana.id, ion.id], payload)

    expect(await notificationsOf(ana.id)).toHaveLength(1)
    expect(await emailJobs(ana.id)).toHaveLength(0)
    expect(await emailJobs(ion.id)).toHaveLength(1)
  })

  it("rejects a payload that doesn't match the type", async () => {
    const ana = await createUser()

    await expect(
      notify("new-message", ana.id, { ...payload, link: "not a link" })
    ).rejects.toThrow()
    expect(await notificationsOf(ana.id)).toHaveLength(0)
  })
})
