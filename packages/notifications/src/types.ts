/*
 * Every notification the app can send: its type id, what its payload holds,
 * and which channels it can reach people on. A user's notification_preference
 * rows turn those channels on or off per type. Keep this file free of server
 * imports: the web app renders notifications with these types.
 */
import type { NotificationChannel } from "@workspace/db/schema"
import { z } from "zod"

/** For each channel a type uses, whether it's on for someone who hasn't chosen. */
export type ChannelDefaults = Partial<Record<NotificationChannel, boolean>>

type NotificationDefinition = {
  payload: z.ZodType<Record<string, unknown>>
  /** The channels it's sent on; one left out is never used for this type. */
  channels: ChannelDefaults
}

export const NOTIFICATION_TYPES = {
  /** A new message in a business ↔ customer conversation. */
  "new-message": {
    payload: z.object({
      conversationId: z.uuid(),
      /** Who wrote it. */
      senderName: z.string(),
      /** The business the conversation is with. */
      organizationName: z.string(),
      /** The start of the message. */
      preview: z.string(),
      /** Where the app opens the conversation. */
      path: z.string(),
    }),
    channels: {
      in_app: true,
    },
  },
} satisfies Record<string, NotificationDefinition>

export type NotificationType = keyof typeof NOTIFICATION_TYPES

export const NOTIFICATION_TYPE_IDS = Object.keys(
  NOTIFICATION_TYPES
) as NotificationType[]

/** The channels `type` is sent on, with their defaults. */
export function channelDefaults(type: NotificationType): ChannelDefaults {
  return NOTIFICATION_TYPES[type].channels
}

export type NotificationPayload<T extends NotificationType> = z.infer<
  (typeof NOTIFICATION_TYPES)[T]["payload"]
>

/** Languages notifications are written in; the first is the fallback. */
export const NOTIFICATION_LOCALES = ["en", "ro"] as const

export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number]

/** The language to write to someone in, from their saved `user.locale`. */
export function notificationLocale(saved: string | null | undefined) {
  return NOTIFICATION_LOCALES.find((locale) => locale === saved) ?? "en"
}

/** The job queued for each recipient who gets a notification by email. */
export type NotificationEmailJob<
  T extends NotificationType = NotificationType,
> = {
  type: T
  userId: string
  organizationId: string | null
  payload: NotificationPayload<T>
  /** Their in-app notification, or null when they turned in-app off. */
  notificationId: string | null
}
