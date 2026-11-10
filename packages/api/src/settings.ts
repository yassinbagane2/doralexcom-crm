/*
 * A business's email service and web address, shared by the API and the web
 * forms. Keep this file free of server imports: it ends up in client bundles.
 */

/** Keep in step with `emailSettings.provider` in packages/db. */
export const EMAIL_PROVIDERS = ["resend", "postmark", "smtp"] as const

export type EmailProvider = (typeof EMAIL_PROVIDERS)[number]

export const EMAIL_SETTINGS_LIMITS = {
  fromName: 100,
  email: 254,
  host: 253,
  username: 254,
  secret: 1000,
} as const

/** The common SMTP ports, for the form's hint. */
export const SMTP_DEFAULT_PORT = 587

/**
 * The TXT record that proves a business controls a domain lives at
 * `<prefix>.<hostname>`.
 */
export const DOMAIN_CHALLENGE_PREFIX = "_duralex-challenge"

/** Why a domain isn't active yet. Keys of the web app's `Domain.errors`. */
export const DOMAIN_ERRORS = [
  "TXT_MISSING",
  "NOT_POINTED",
  "DNS_LOOKUP_FAILED",
  "DOMAIN_TAKEN",
] as const

export type DomainError = (typeof DOMAIN_ERRORS)[number]

/**
 * What someone typed as a web address, reduced to its hostname:
 * `https://Portal.Example.com/` → `portal.example.com`.
 */
export function normalizeHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

/** A public DNS name with at least two labels and an alphabetic TLD. */
export function isValidHostname(hostname: string) {
  if (hostname.length > 253) return false
  const labels = hostname.split(".")
  if (labels.length < 2) return false
  if (!/^[a-z]{2,63}$/.test(labels.at(-1)!) && !/^xn--/.test(labels.at(-1)!)) {
    return false
  }
  return labels.every((label) => LABEL.test(label))
}
