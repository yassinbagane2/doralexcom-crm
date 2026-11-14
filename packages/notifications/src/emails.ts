import type { Email } from "@workspace/auth/email"

import type {
  NotificationLocale,
  NotificationPayload,
  NotificationType,
} from "./types"

/*
 * The email each emailed notification type sends, in every language. Plain
 * text, like the app's other emails. A type sent on the email channel (see
 * NOTIFICATION_TYPES) needs its template here; none is emailed yet.
 */

type EmailContent = Omit<Email, "to">

type Templates = {
  [T in NotificationType]?: Record<
    NotificationLocale,
    (payload: NotificationPayload<T>) => EmailContent
  >
}

/** Closes every notification email: where to turn them off. */
const FOOTER: Record<NotificationLocale, string> = {
  en: "You can turn these emails off in your notification preferences.",
  ro: "Poți opri aceste emailuri din preferințele de notificare.",
}

const TEMPLATES: Templates = {}

/** The subject and body of `type`'s email in `locale`; null if it has none. */
export function renderEmail<T extends NotificationType>(
  type: T,
  payload: NotificationPayload<T>,
  locale: NotificationLocale
): EmailContent | null {
  const render = TEMPLATES[type]?.[locale] as
    | ((payload: NotificationPayload<T>) => EmailContent)
    | undefined
  if (!render) return null

  const { subject, text } = render(payload)
  return { subject, text: `${text}\n\n${FOOTER[locale]}` }
}
