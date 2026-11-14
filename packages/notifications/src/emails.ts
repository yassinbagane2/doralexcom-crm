import type { Email } from "@workspace/auth/email"

import type {
  NotificationLocale,
  NotificationPayload,
  NotificationType,
} from "./types"

/*
 * The email each notification type sends, in every language. Plain text,
 * like the app's other emails.
 */

type EmailContent = Omit<Email, "to">

type Templates = {
  [T in NotificationType]: Record<
    NotificationLocale,
    (payload: NotificationPayload<T>) => EmailContent
  >
}

/** Closes every notification email: where to turn them off. */
const FOOTER: Record<NotificationLocale, string> = {
  en: "You can turn these emails off in your notification preferences.",
  ro: "Poți opri aceste emailuri din preferințele de notificare.",
}

const TEMPLATES: Templates = {
  "new-message": {
    en: ({ senderName, organizationName, preview, link }) => ({
      subject: `New message from ${senderName}`,
      text: [
        `${senderName} sent you a message (${organizationName}):`,
        preview,
        `Read and reply: ${link}`,
        FOOTER.en,
      ].join("\n\n"),
    }),
    ro: ({ senderName, organizationName, preview, link }) => ({
      subject: `Mesaj nou de la ${senderName}`,
      text: [
        `${senderName} ți-a trimis un mesaj (${organizationName}):`,
        preview,
        `Citește și răspunde: ${link}`,
        FOOTER.ro,
      ].join("\n\n"),
    }),
  },
}

/** The subject and body of `type`'s email, in `locale`. */
export function renderEmail<T extends NotificationType>(
  type: T,
  payload: NotificationPayload<T>,
  locale: NotificationLocale
): EmailContent {
  const render = TEMPLATES[type][locale] as (
    payload: NotificationPayload<T>
  ) => EmailContent
  return render(payload)
}
