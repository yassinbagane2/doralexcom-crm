/*
 * Every notification the app can send: its type id, what its payload holds,
 * and which channels it reaches by default. A user's notification_preference
 * rows override the defaults per type and channel. Keep this file free of
 * server imports: the web app renders notifications with these types.
 */
import type { NotificationChannel } from "@workspace/db/schema"
import { z } from "zod"

type NotificationDefinition = {
  payload: z.ZodType<Record<string, unknown>>
  /** Whether each channel is on for someone who hasn't chosen. */
  defaults: Record<NotificationChannel, boolean>
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
      /** The same, absolute, for emails. */
      link: z.url(),
    }),
    defaults: { in_app: true, email: true },
  },
} satisfies Record<string, NotificationDefinition>

export type NotificationType = keyof typeof NOTIFICATION_TYPES

export const NOTIFICATION_TYPE_IDS = Object.keys(
  NOTIFICATION_TYPES
) as NotificationType[]

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
