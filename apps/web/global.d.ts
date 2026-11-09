import type { Locale } from "@/i18n/locale"
import type { Messages } from "@/messages"

// Types `useTranslations` / `getTranslations` keys against the English files.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale
    Messages: Messages
  }
}
