import { createHmac, timingSafeEqual } from "node:crypto"

import { env } from "../../env"

/*
 * The permission to open one document's print page. That page has no
 * session: the API mints a token naming the document, valid a few minutes,
 * and its headless Chrome opens the page with it.
 */

const TOKEN_TTL_MS = 5 * 60 * 1000

function tokenSignature(documentId: string, expires: number) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`signed-pdf:${documentId}:${expires}`)
    .digest("base64url")
}

export function printToken(documentId: string) {
  const expires = Date.now() + TOKEN_TTL_MS
  return `${expires}.${tokenSignature(documentId, expires)}`
}

export function verifyPrintToken(documentId: string, token: string) {
  const [expiresText, signature] = token.split(".")
  const expires = Number(expiresText)
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) {
    return false
  }
  const expected = Buffer.from(tokenSignature(documentId, expires))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
