import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { NOTIFICATION_CHANNELS, notification, user } from "@workspace/db/schema"
import {
  NOTIFICATION_LOCALES,
  NOTIFICATION_TYPE_IDS,
  savePreference,
  userPreferences,
} from "@workspace/notifications"
import {
  and,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  type SQL,
} from "drizzle-orm"
import { z } from "zod"

import { o, protectedProcedure } from "../index"
import {
  NOTIFICATION_FILTERS,
  NOTIFICATIONS_PAGE_SIZE,
  SNOOZE_MAX_DAYS,
  type NotificationFilter,
} from "../notification"

/*
 * The signed-in user's notification feed and settings. Every procedure works
 * on their own notifications only: each query is scoped to their user id, so
 * someone else's id is simply not found.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const itemSchema = z.object({
  id: z.string(),
  /** A notification type id; the payload's shape depends on it. */
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  organizationId: z.string().nullable(),
  readAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  snoozedUntil: z.date().nullable(),
  createdAt: z.date(),
})

const itemColumns = {
  id: notification.id,
  type: notification.type,
  payload: notification.payload,
  organizationId: notification.organizationId,
  readAt: notification.readAt,
  archivedAt: notification.archivedAt,
  snoozedUntil: notification.snoozedUntil,
  createdAt: notification.createdAt,
}

const idInput = z.object({ id: z.uuid() })

/** `filter`'s view at `now`: the SQL twin of inFilter() in ../notification. */
function inView(filter: NotificationFilter, now: Date): SQL {
  const notArchived = isNull(notification.archivedAt)
  const awake = or(
    isNull(notification.snoozedUntil),
    lte(notification.snoozedUntil, now)
  )
  switch (filter) {
    case "all":
      return and(notArchived, awake)!
    case "unread":
      return and(notArchived, awake, isNull(notification.readAt))!
    case "archived":
      return isNotNull(notification.archivedAt)
    case "snoozed":
      return and(notArchived, gt(notification.snoozedUntil, now))!
  }
}

/** The user's own notifications. */
const own = (userId: string) => eq(notification.userId, userId)

/** Changes one of the user's notifications; not found if it isn't theirs. */
async function updateOwn(
  userId: string,
  id: string,
  changes: Partial<typeof notification.$inferInsert>
) {
  const [updated] = await db
    .update(notification)
    .set(changes)
    .where(and(eq(notification.id, id), own(userId)))
    .returning({ id: notification.id })
  if (!updated) throw new ORPCError("NOT_FOUND")
}

/** Changes every notification of the user's that `where` picks. */
async function updateAllOwn(
  userId: string,
  where: SQL | undefined,
  changes: Partial<typeof notification.$inferInsert>
) {
  await db
    .update(notification)
    .set(changes)
    .where(and(own(userId), where))
}

/** A single-notification change: POST /notifications/{id}/<action>. */
function itemAction(
  action: string,
  changes: () => Partial<typeof notification.$inferInsert>
) {
  return protectedProcedure
    .route({
      method: "POST",
      path: `/{id}/${action}`,
      tags: ["notification"],
    })
    .input(idInput)
    .output(z.void())
    .handler(({ context, input }) =>
      updateOwn(context.session.user.id, input.id, changes())
    )
}

/** A change to every notification of a view: POST /notifications/<action>. */
function bulkAction(
  action: string,
  where: (now: Date) => SQL | undefined,
  changes: (now: Date) => Partial<typeof notification.$inferInsert>
) {
  return protectedProcedure
    .route({ method: "POST", path: `/${action}`, tags: ["notification"] })
    .output(z.void())
    .handler(({ context }) => {
      const now = new Date()
      return updateAllOwn(context.session.user.id, where(now), changes(now))
    })
}

export const notificationRouter = o.prefix("/notifications").router({
  /**
   * A page of one view of the feed, newest first: the latest, or those after
   * `cursor` (the last notification of the previous page).
   */
  list: protectedProcedure
    .route({ method: "GET", path: "/", tags: ["notification"] })
    .input(
      z.object({
        filter: z.enum(NOTIFICATION_FILTERS).default("all"),
        cursor: z.uuid().optional(),
      })
    )
    .output(
      z.object({
        items: z.array(itemSchema),
        /** Pass as `cursor` for the next page; null after the last one. */
        nextCursor: z.string().nullable(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id

      let older: SQL | undefined
      if (input.cursor) {
        const cursor = await db.query.notification.findFirst({
          where: and(eq(notification.id, input.cursor), own(userId)),
          columns: { id: true, createdAt: true },
        })
        if (!cursor) throw new ORPCError("BAD_REQUEST")
        older = or(
          lt(notification.createdAt, cursor.createdAt),
          and(
            eq(notification.createdAt, cursor.createdAt),
            lt(notification.id, cursor.id)
          )
        )
      }

      const rows = await db
        .select(itemColumns)
        .from(notification)
        .where(and(own(userId), inView(input.filter, new Date()), older))
        .orderBy(desc(notification.createdAt), desc(notification.id))
        .limit(NOTIFICATIONS_PAGE_SIZE + 1)

      const items = rows.slice(0, NOTIFICATIONS_PAGE_SIZE).map((row) => ({
        ...row,
        payload: row.payload as Record<string, unknown>,
      }))
      return {
        items,
        nextCursor:
          rows.length > NOTIFICATIONS_PAGE_SIZE ? items.at(-1)!.id : null,
      }
    }),

  /** Unread notifications in the inbox: the bell's badge. */
  unreadCount: protectedProcedure
    .route({ method: "GET", path: "/unread-count", tags: ["notification"] })
    .output(z.number())
    .handler(async ({ context }) => {
      const [result] = await db
        .select({ value: count() })
        .from(notification)
        .where(and(own(context.session.user.id), inView("unread", new Date())))
      return result?.value ?? 0
    }),

  markRead: itemAction("read", () => ({ readAt: new Date() })),
  markUnread: itemAction("unread", () => ({ readAt: null })),
  archive: itemAction("archive", () => ({ archivedAt: new Date() })),
  unarchive: itemAction("unarchive", () => ({ archivedAt: null })),
  unsnooze: itemAction("unsnooze", () => ({ snoozedUntil: null })),

  /** Hides a notification from the inbox until `until`. */
  snooze: protectedProcedure
    .route({ method: "POST", path: "/{id}/snooze", tags: ["notification"] })
    .input(
      idInput.extend({
        until: z
          .date()
          .refine((until) => until.getTime() > Date.now(), {
            message: "Pick a time in the future.",
          })
          .refine(
            (until) => until.getTime() <= Date.now() + SNOOZE_MAX_DAYS * DAY_MS,
            { message: `Snooze for at most ${SNOOZE_MAX_DAYS} days.` }
          ),
      })
    )
    .output(z.void())
    .handler(({ context, input }) =>
      updateOwn(context.session.user.id, input.id, {
        snoozedUntil: input.until,
      })
    ),

  /** Reads everything unread in the inbox. */
  markAllRead: bulkAction(
    "read-all",
    (now) => inView("unread", now),
    (now) => ({ readAt: now })
  ),

  /** Archives everything in the inbox. */
  archiveAll: bulkAction(
    "archive-all",
    (now) => inView("all", now),
    (now) => ({ archivedAt: now })
  ),

  /** Archives what's been read in the inbox. */
  archiveRead: bulkAction(
    "archive-read",
    (now) => and(inView("all", now), isNotNull(notification.readAt)),
    (now) => ({ archivedAt: now })
  ),

  /** Which channels each notification type reaches the user on. */
  getPreferences: protectedProcedure
    .route({ method: "GET", path: "/preferences", tags: ["notification"] })
    .output(
      z.array(
        z.object({
          type: z.enum(NOTIFICATION_TYPE_IDS),
          channels: z.record(z.enum(NOTIFICATION_CHANNELS), z.boolean()),
        })
      )
    )
    .handler(({ context }) => userPreferences(context.session.user.id)),

  /** Turns one notification type on or off on one channel. */
  setPreference: protectedProcedure
    .route({ method: "PUT", path: "/preferences", tags: ["notification"] })
    .input(
      z.object({
        type: z.enum(NOTIFICATION_TYPE_IDS),
        channel: z.enum(NOTIFICATION_CHANNELS),
        enabled: z.boolean(),
      })
    )
    .output(z.void())
    .handler(({ context, input }) =>
      savePreference(
        context.session.user.id,
        input.type,
        input.channel,
        input.enabled
      )
    ),

  /** The language the user reads the app in, which their emails follow. */
  setLocale: protectedProcedure
    .route({ method: "PUT", path: "/locale", tags: ["notification"] })
    .input(z.object({ locale: z.enum(NOTIFICATION_LOCALES) }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      await db
        .update(user)
        .set({ locale: input.locale })
        .where(eq(user.id, context.session.user.id))
    }),
})
