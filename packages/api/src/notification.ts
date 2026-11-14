/*
 * The notification feed's filters and limits, shared by the API and the web
 * app. Keep this file free of server imports: it ends up in client bundles.
 */

/**
 * The feed's views: the inbox ("all": not archived, not snoozed), its unread
 * part, archived notifications, and those snoozed until later.
 */
export const NOTIFICATION_FILTERS = [
  "all",
  "unread",
  "archived",
  "snoozed",
] as const

export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number]

/** Notifications loaded at a time, newest first. */
export const NOTIFICATIONS_PAGE_SIZE = 20

/** Furthest a notification can be snoozed, in days. */
export const SNOOZE_MAX_DAYS = 90

export interface NotificationState {
  readAt: Date | null
  archivedAt: Date | null
  snoozedUntil: Date | null
}

/**
 * Whether a notification belongs in `filter`'s view at `now`. The API's list
 * applies the same rules in SQL (routers/notification.ts); the web app uses
 * this to move notifications between views before the server answers.
 */
export function inFilter(
  filter: NotificationFilter,
  { readAt, archivedAt, snoozedUntil }: NotificationState,
  now = new Date()
) {
  const snoozed = snoozedUntil !== null && snoozedUntil > now
  switch (filter) {
    case "all":
      return !archivedAt && !snoozed
    case "unread":
      return !archivedAt && !snoozed && !readAt
    case "archived":
      return archivedAt !== null
    case "snoozed":
      return !archivedAt && snoozed
  }
}
