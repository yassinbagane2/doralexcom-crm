/*
 * Supported languages. Client-safe: the language switcher imports this too.
 * The locale lives in a cookie rather than the URL, so every route keeps one
 * address whatever language it is read in.
 */

export const LOCALES = ["en", "ro"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_COOKIE = "locale"

/** Each language named in itself, so it's recognisable whatever is active. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ro: "Română",
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale)
}

/**
 * First supported language in an `Accept-Language` header, so a visitor who
 * hasn't picked one yet sees the app in their browser's language.
 */
export function matchAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null

  const preferred = header
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=")
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { tag } of preferred) {
    const base = tag.split("-")[0]
    if (isLocale(base)) return base
  }

  return null
}
