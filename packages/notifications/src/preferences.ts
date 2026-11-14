import { db } from "@workspace/db"
import {
  notificationPreference,
  type NotificationChannel,
} from "@workspace/db/schema"
import { and, eq, inArray } from "drizzle-orm"

import {
  NOTIFICATION_TYPE_IDS,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "./types"

/** Whether each channel is on, for one user and one type. */
export type ChannelSettings = Record<NotificationChannel, boolean>

/**
 * Which channels each user gets `type` on: their own choice where they made
 * one, the type's default otherwise.
 */
export async function enabledChannels(
  type: NotificationType,
  userIds: string[]
) {
  const choices = await db
    .select({
      userId: notificationPreference.userId,
      channel: notificationPreference.channel,
      enabled: notificationPreference.enabled,
    })
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.type, type),
        inArray(notificationPreference.userId, userIds)
      )
    )

  const channels = new Map<string, ChannelSettings>(
    userIds.map((userId) => [userId, { ...NOTIFICATION_TYPES[type].defaults }])
  )
  for (const choice of choices) {
    channels.get(choice.userId)![choice.channel] = choice.enabled
  }
  return channels
}

/** One user's settings for every notification type. */
export async function userPreferences(userId: string) {
  const choices = await db
    .select({
      type: notificationPreference.type,
      channel: notificationPreference.channel,
      enabled: notificationPreference.enabled,
    })
    .from(notificationPreference)
    .where(eq(notificationPreference.userId, userId))

  return NOTIFICATION_TYPE_IDS.map((type) => {
    const channels: ChannelSettings = { ...NOTIFICATION_TYPES[type].defaults }
    for (const choice of choices) {
      if (choice.type === type) channels[choice.channel] = choice.enabled
    }
    return { type, channels }
  })
}

/** Saves one user's choice for one type on one channel. */
export async function savePreference(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  enabled: boolean
) {
  await db
    .insert(notificationPreference)
    .values({ userId, type, channel, enabled })
    .onConflictDoUpdate({
      target: [
        notificationPreference.userId,
        notificationPreference.type,
        notificationPreference.channel,
      ],
      set: { enabled },
    })
}
