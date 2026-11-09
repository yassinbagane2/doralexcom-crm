import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { messages } from "@/messages"

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  matchAcceptLanguage,
} from "./locale"

/** Chosen language first, then the browser's, then English. */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(chosen)
    ? chosen
    : (matchAcceptLanguage((await headers()).get("accept-language")) ??
      DEFAULT_LOCALE)

  return {
    locale,
    messages: messages[locale],
  }
})
