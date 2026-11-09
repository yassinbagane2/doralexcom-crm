/*
 * Just enough user-agent parsing to label a session "Chrome on macOS". Order
 * matters: Edge and Opera also claim to be Chrome, and Chrome claims Safari.
 * Returns the parts rather than a sentence, so the caller can word it in the
 * active language.
 */

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
]

function match(userAgent: string, table: [RegExp, string][]) {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1]
}

/** Null when there's no user agent at all; either part may be unknown. */
export function parseUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return null

  return {
    browser: match(userAgent, BROWSERS),
    system: match(userAgent, SYSTEMS),
  }
}
