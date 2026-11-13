import { createHmac } from "node:crypto"

import { novu } from "./client"
import { env } from "./env"

/** The fields of a user Novu keeps on its subscriber. */
export type NotifiedUser = {
  id: string
  name: string
  email: string
}

/**
 * Proves to Novu that the browser asking for `subscriberId`'s inbox was sent
 * by us. Novu rejects inbox sessions without it once HMAC is turned on for
 * the environment (required in production), so nobody can read someone
 * else's notifications by guessing their id.
 */
export function subscriberHash(subscriberId: string) {
  if (!env.NOVU_SECRET_KEY) return undefined
  return createHmac("sha256", env.NOVU_SECRET_KEY)
    .update(subscriberId)
    .digest("hex")
}

/*
 * Users already copied to Novu by this process, with the details sent, so a
 * page load doesn't call Novu again unless the name or email changed.
 */
const synced = new Map<string, string>()

/**
 * Creates or updates the user's subscriber in Novu, keyed by their user id,
 * so workflows can reach them by email as well as in the inbox.
 */
export async function syncSubscriber(user: NotifiedUser, locale?: string) {
  const sdk = novu()
  if (!sdk) return

  const fingerprint = JSON.stringify([user.name, user.email, locale])
  if (synced.get(user.id) === fingerprint) return

  const [firstName, ...rest] = user.name.trim().split(/\s+/)
  // Upserts: `failIfExists` false updates a subscriber that already exists.
  await sdk.subscribers.create(
    {
      subscriberId: user.id,
      email: user.email,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      ...(locale ? { locale } : {}),
    },
    false
  )
  synced.set(user.id, fingerprint)
}
