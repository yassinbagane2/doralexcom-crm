import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

import { env } from "../env"

/*
 * Encrypts the secrets businesses hand us (email API keys, SMTP passwords)
 * before they reach the database: AES-256-GCM, keyed from the auth secret.
 * Rotating BETTER_AUTH_SECRET makes stored secrets unreadable; businesses
 * then enter them again.
 */

const VERSION = "v1"

const key = Buffer.from(
  hkdfSync("sha256", env.BETTER_AUTH_SECRET, "", "settings-secret-box", 32)
)

export function sealSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":")
}

/** The plain secret, or null when it can't be decrypted (secret rotated). */
export function openSecret(sealed: string) {
  const [version, iv, tag, encrypted] = sealed.split(":")
  if (version !== VERSION || !iv || !tag || !encrypted) return null

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url")
    )
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
