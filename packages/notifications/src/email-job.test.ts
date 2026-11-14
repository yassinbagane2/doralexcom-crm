import { sendEmail } from "@workspace/auth/email"
import { db } from "@workspace/db"
import { notification } from "@workspace/db/schema"
import { createUser, resetDatabase } from "@workspace/db/test"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { deliverNotificationEmail } from "./email-job"
import { savePreference } from "./preferences"
import type { NotificationEmailJob } from "./types"

vi.mock("@workspace/auth/email", () => ({ sendEmail: vi.fn() }))

const payload = {
  conversationId: "6f1c2d3e-4b5a-4c6d-8e7f-901234567890",
  senderName: "Ana Popescu",
  organizationName: "Acme Rentals",
  preview: "Hello!",
  path: "/inbox",
  link: "http://localhost:3000/inbox",
}

function job(
  userId: string,
  notificationId: string | null = null
): NotificationEmailJob {
  return {
    type: "new-message",
    userId,
    organizationId: null,
    payload,
    notificationId,
  }
}

beforeEach(async () => {
  vi.mocked(sendEmail).mockClear()
  await resetDatabase()
})

afterAll(async () => {
  await db.$client.end()
})

describe("the notification email job", () => {
  it("emails the recipient in their language", async () => {
    const ion = await createUser({ locale: "ro" })

    expect(await deliverNotificationEmail(job(ion.id))).toBe(true)

    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ion.email,
        subject: "Mesaj nou de la Ana Popescu",
      })
    )
  })

  it("writes in English without a saved language", async () => {
    const ana = await createUser()

    await deliverNotificationEmail(job(ana.id))

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "New message from Ana Popescu" })
    )
  })

  it("skips someone who turned email off after it was queued", async () => {
    const ana = await createUser()
    await savePreference(ana.id, "new-message", "email", false)

    expect(await deliverNotificationEmail(job(ana.id))).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("skips a notification already read in the app", async () => {
    const ana = await createUser()
    const [read] = await db
      .insert(notification)
      .values({
        userId: ana.id,
        type: "new-message",
        payload,
        readAt: new Date(),
      })
      .returning()

    expect(await deliverNotificationEmail(job(ana.id, read!.id))).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
