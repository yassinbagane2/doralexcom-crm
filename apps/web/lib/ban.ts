/*
 * Choices offered when an admin suspends an account. The reason is stored on
 * the account as written here, so the values stay in English; the labels are
 * translated (`AdminBan.reasons` / `AdminBan.durations`).
 */

export const BAN_REASONS = [
  "termsViolation",
  "suspiciousActivity",
  "billingIssue",
  "spam",
  "securityRisk",
  "supportEscalation",
] as const

export type BanReason = (typeof BAN_REASONS)[number]

export const BAN_REASON_TEXT: Record<BanReason, string> = {
  termsViolation: "Terms of service violation",
  suspiciousActivity: "Suspicious account activity",
  billingIssue: "Payment or billing issue",
  spam: "Spam or abuse",
  securityRisk: "Security risk",
  supportEscalation: "Support escalation",
}

const DAY = 24 * 60 * 60

/** Seconds until the ban lifts on its own; null means it never does. */
export const BAN_DURATIONS = {
  permanent: null,
  sevenDays: 7 * DAY,
  thirtyDays: 30 * DAY,
  ninetyDays: 90 * DAY,
} as const

export type BanDuration = keyof typeof BAN_DURATIONS
