import { db } from "@workspace/db"
import {
  NOTIFICATION_CHANNELS,
  notificationPreference,
  type NotificationChannel,
} from "@workspace/db/schema"
import { and, eq, inArray } from "drizzle-orm"

import {
  channelDefaults,
  NOTIFICATION_TYPE_IDS,
  type ChannelDefaults,
  type NotificationType,
} from "./types"

/** Whether each channel is on, for one user and one type. */
export type ChannelSettings = Record<NotificationChannel, boolean>

/** Whether `type` is ever sent on `channel` (see NOTIFICATION_TYPES). */
export function usesChannel(
  type: NotificationType,
  channel: NotificationChannel
) {
  return channelDefaults(type)[channel] !== undefined
}

/** Every channel, as `type` sends it by default: the ones it doesn't use are off. */
function defaultSettings(type: NotificationType): ChannelSettings {
  const defaults = channelDefaults(type)
  return Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [
      channel,
      defaults[channel] ?? false,
    ])
  ) as ChannelSettings
}

/**
 * Which channels each user gets `type` on: their own choice where they made
 * one, the type's default otherwise, and never a channel the type doesn't use.
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
    userIds.map((userId) => [userId, defaultSettings(type)])
  )
  for (const choice of choices) {
    if (usesChannel(type, choice.channel)) {
      channels.get(choice.userId)![choice.channel] = choice.enabled
    }
  }
  return channels
}

/** One user's settings for every type, on the channels each type uses. */
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
    const channels: ChannelDefaults = { ...channelDefaults(type) }
    for (const choice of choices) {
      if (choice.type === type && usesChannel(type, choice.channel)) {
        channels[choice.channel] = choice.enabled
      }
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
