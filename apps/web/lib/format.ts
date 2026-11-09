/*
 * Dates in the reader's language. Callers pass the active locale, from
 * `useLocale()` in client components or `getLocale()` on the server.
 */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
]

export function formatDate(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(date)
  )
}

/**
 * "5 minutes ago", "yesterday"… or null under a minute, so the caller can say
 * "just now" in its own words.
 */
export function formatRelative(date: Date | string, locale: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit)
    }
  }

  return null
}
