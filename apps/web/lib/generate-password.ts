import { PASSWORD_MIN_LENGTH } from "@workspace/auth/password"

const LOWER = "abcdefghijklmnopqrstuvwxyz"
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const DIGITS = "0123456789"
const SPECIAL = "!@#$%^&*"
const ALL = LOWER + UPPER + DIGITS + SPECIAL

function randomIndex(max: number) {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return (value ?? 0) % max
}

function pick(chars: string) {
  return chars[randomIndex(chars.length)]!
}

/**
 * A password that passes the shared policy: one of each required class seeded
 * in, the rest random, then shuffled so the required ones aren't always first.
 */
export function generatePassword(length = Math.max(16, PASSWORD_MIN_LENGTH)) {
  const chars = [pick(UPPER), pick(SPECIAL), pick(DIGITS), pick(LOWER)]
  while (chars.length < length) chars.push(pick(ALL))

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }

  return chars.join("")
}
