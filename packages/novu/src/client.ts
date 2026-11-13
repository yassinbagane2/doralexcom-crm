import { Novu } from "@novu/api"

import { env } from "./env"

let client: Novu | undefined

/** Novu's server SDK, or null when Novu isn't configured. */
export function novu() {
  if (!env.NOVU_SECRET_KEY) return null
  client ??= new Novu({
    secretKey: env.NOVU_SECRET_KEY,
    ...(env.NOVU_API_URL ? { serverURL: env.NOVU_API_URL } : {}),
  })
  return client
}
