import { db } from "@workspace/db"
import { customDomain } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

/*
 * Businesses' own web addresses, once verified (see the API's settings
 * router). Better Auth trusts them as origins, the API server routes and
 * scopes cookies for them, and the TLS proxy asks before issuing a
 * certificate. Asked on many requests, so the list is cached briefly: a
 * domain just verified or removed takes effect within `CACHE_MS`.
 */

const CACHE_MS = 30_000

let cache: { hostnames: Set<string>; expiresAt: number } | null = null

async function activeHostnames() {
  if (cache && cache.expiresAt > Date.now()) return cache.hostnames

  let rows: { hostname: string }[]
  try {
    rows = await db
      .select({ hostname: customDomain.hostname })
      .from(customDomain)
      .where(eq(customDomain.status, "active"))
  } catch (error) {
    // Every auth request asks for trusted origins: a failed lookup must not
    // take sign-in down. Trust no custom domain until the next try.
    console.error("[custom-domains] Lookup failed:", error)
    return cache?.hostnames ?? new Set<string>()
  }

  cache = {
    hostnames: new Set(rows.map((row) => row.hostname)),
    expiresAt: Date.now() + CACHE_MS,
  }
  return cache.hostnames
}

/** Call after verifying or removing a domain, so this process sees it now. */
export function forgetCustomDomains() {
  cache = null
}

/** Whether `hostname` (no port, any case) is a business's active domain. */
export async function isActiveCustomDomain(hostname: string) {
  return (await activeHostnames()).has(hostname.toLowerCase())
}

/** `https://` origins of every active domain. */
export async function customDomainOrigins() {
  return [...(await activeHostnames())].map((hostname) => `https://${hostname}`)
}
