/*
 * Just enough user-agent parsing to label a session "Chrome on macOS". Order
 * matters: Edge and Opera also claim to be Chrome, and Chrome claims Safari.
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

export function describeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) {
    return "Unknown device"
  }

  const browser = match(userAgent, BROWSERS) ?? "Unknown browser"
  const system = match(userAgent, SYSTEMS)
  return system ? `${browser} on ${system}` : browser
}
