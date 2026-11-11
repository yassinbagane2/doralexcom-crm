import { createHash } from "node:crypto"

/** Hex SHA-256 of a string (as UTF-8) or of raw bytes. */
export function sha256(data: string | Uint8Array) {
  return createHash("sha256").update(data).digest("hex")
}
