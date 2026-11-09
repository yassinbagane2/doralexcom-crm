const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
]

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date))
}

/** "5 minutes ago", "yesterday"… and "just now" under a minute. */
export function formatRelative(date: Date | string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeFormatter.format(Math.round(seconds / size), unit)
    }
  }

  return "just now"
}
