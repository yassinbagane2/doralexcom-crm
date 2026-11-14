import { relations, sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"

/*
 * Notifications the app sends its users: one row per recipient, shown in their
 * in-app feed, plus what each user has turned on or off. Which types exist and
 * what their payloads hold lives in @workspace/notifications.
 */

/** Where a notification can reach someone. */
export const NOTIFICATION_CHANNELS = ["in_app", "email"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const notification = pgTable(
  "notification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The business it's about, when there is one. */
    organizationId: uuid("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    /** A notification type id, such as "new-message". */
    type: text("type").notNull(),
    /** What the type needs to render it, validated by its schema on send. */
    payload: jsonb("payload").notNull(),
    readAt: timestamp("read_at"),
    /** When it was first shown in the feed, read or not (clears the badge). */
    seenAt: timestamp("seen_at"),
    archivedAt: timestamp("archived_at"),
    /** Hidden from the feed until then. */
    snoozedUntil: timestamp("snoozed_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /**
     * The sender's id for this event. A retried send with the same id adds
     * nothing: unique per user, and null (never deduplicated) when not given.
     */
    transactionId: text("transaction_id"),
  },
  (table) => [
    uniqueIndex("notification_user_transaction_uidx").on(
      table.userId,
      table.transactionId
    ),
    // A user's feed, newest first.
    index("notification_user_createdAt_idx").on(
      table.userId,
      table.createdAt.desc()
    ),
    // Unread counts: only the rows they count, so it stays small.
    index("notification_user_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} is null and ${table.archivedAt} is null`),
  ]
)

/**
 * A user's choice for one type on one channel. No row means the type's
 * default applies.
 */
export const notificationPreference = pgTable(
  "notification_preference",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    channel: text("channel", { enum: NOTIFICATION_CHANNELS }).notNull(),
    enabled: boolean("enabled").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.type, table.channel] }),
  ]
)

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [notification.organizationId],
    references: [organization.id],
  }),
}))

export const notificationPreferenceRelations = relations(
  notificationPreference,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPreference.userId],
      references: [user.id],
    }),
  })
)
