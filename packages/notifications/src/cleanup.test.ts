import { db } from "@workspace/db"
import { notification } from "@workspace/db/schema"
import { createUser, resetDatabase } from "@workspace/db/test"
import { afterAll, beforeEach, expect, it } from "vitest"

import { deleteExpiredNotifications } from "./cleanup"

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date()
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS)

beforeEach(resetDatabase)

afterAll(async () => {
  await db.$client.end()
})

it("deletes notifications past 90 days, or past 30 once archived", async () => {
  const { id: userId } = await createUser()
  const add = (createdAt: Date, archivedAt: Date | null = null) =>
    db
      .insert(notification)
      .values({
        userId,
        type: "new-message",
        payload: {},
        createdAt,
        archivedAt,
      })
      .returning({ id: notification.id })
      .then(([row]) => row!.id)

  const kept = [await add(daysAgo(89)), await add(daysAgo(40), daysAgo(29))]
  await add(daysAgo(91))
  await add(daysAgo(40), daysAgo(31))

  expect(await deleteExpiredNotifications(now)).toBe(2)
  const left = await db.select({ id: notification.id }).from(notification)
  expect(left.map((row) => row.id).sort()).toEqual(kept.sort())
})
