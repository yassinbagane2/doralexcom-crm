import { call, ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { notification } from "@workspace/db/schema"
import { createUser, resetDatabase } from "@workspace/db/test"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import type { Context } from "../context"
import { notificationRouter } from "./notification"

/*
 * Every procedure works on the signed-in user's own notifications only:
 * Ana must not see or change Ion's.
 */

/** A request context signed in as `userId`. */
function signedInAs(userId: string) {
  return {
    headers: new Headers(),
    session: { user: { id: userId }, session: {} },
  } as unknown as Context
}

async function addNotification(userId: string) {
  const [created] = await db
    .insert(notification)
    .values({
      userId,
      type: "new-message",
      payload: { preview: "Hello!" },
    })
    .returning()
  return created!
}

async function reload(id: string) {
  return (await db.query.notification.findFirst({
    where: eq(notification.id, id),
  }))!
}

let ana: Context
let ionsId: string

beforeEach(async () => {
  await resetDatabase()
  ana = signedInAs((await createUser()).id)
  const ion = await createUser()
  ionsId = (await addNotification(ion.id)).id
})

afterAll(async () => {
  await db.$client.end()
})

describe("notification router ownership", () => {
  it("lists and counts only the user's own notifications", async () => {
    const own = await addNotification(ana.session!.user.id)

    const page = await call(notificationRouter.list, {}, { context: ana })
    expect(page.items.map((item) => item.id)).toEqual([own.id])

    const unread = await call(notificationRouter.unreadCount, undefined, {
      context: ana,
    })
    expect(unread).toBe(1)
  })

  it("doesn't page from someone else's notification", async () => {
    await expect(
      call(notificationRouter.list, { cursor: ionsId }, { context: ana })
    ).rejects.toThrow(ORPCError)
  })

  const changes = {
    markRead: notificationRouter.markRead,
    markUnread: notificationRouter.markUnread,
    archive: notificationRouter.archive,
    unarchive: notificationRouter.unarchive,
    unsnooze: notificationRouter.unsnooze,
  }

  for (const [name, procedure] of Object.entries(changes)) {
    it(`can't ${name} someone else's notification`, async () => {
      const before = await reload(ionsId)

      await expect(
        call(procedure, { id: ionsId }, { context: ana })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      expect(await reload(ionsId)).toEqual(before)
    })
  }

  it("can't snooze someone else's notification", async () => {
    await expect(
      call(
        notificationRouter.snooze,
        { id: ionsId, until: new Date(Date.now() + 60 * 60 * 1000) },
        { context: ana }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await reload(ionsId)).snoozedUntil).toBeNull()
  })

  it("leaves others' notifications alone in bulk actions", async () => {
    const before = await reload(ionsId)

    for (const procedure of [
      notificationRouter.markAllRead,
      notificationRouter.archiveAll,
      notificationRouter.archiveRead,
    ]) {
      await call(procedure, undefined, { context: ana })
    }

    expect(await reload(ionsId)).toEqual(before)
  })

  it("changes the user's own notification", async () => {
    const own = await addNotification(ana.session!.user.id)

    await call(notificationRouter.markRead, { id: own.id }, { context: ana })

    expect((await reload(own.id)).readAt).toBeInstanceOf(Date)
  })
})
