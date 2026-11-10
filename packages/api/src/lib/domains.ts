import { Resolver } from "node:dns/promises"

import { customDomainTarget } from "../env"
import { DOMAIN_CHALLENGE_PREFIX, type DomainError } from "../settings"

/*
 * Checks a business's domain in public DNS: a TXT record proving they control
 * it, and a CNAME (or, at the zone apex, A/AAAA records) sending it to the
 * platform. Asks public resolvers directly, so a record just added isn't
 * hidden behind a stale local cache.
 */

const resolver = new Resolver({ timeout: 5000, tries: 2 })
resolver.setServers(["1.1.1.1", "8.8.8.8"])

/** No such name or record: an answer, not a failure to get one. */
const isMissing = (error: unknown) =>
  ["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(
    (error as { code?: string }).code ?? ""
  )

class LookupFailed extends Error {}

async function lookup<T>(query: () => Promise<T[]>): Promise<T[]> {
  try {
    return await query()
  } catch (error) {
    if (isMissing(error)) return []
    throw new LookupFailed((error as Error).message)
  }
}

const sameName = (a: string, b: string) =>
  a.toLowerCase().replace(/\.$/, "") === b.toLowerCase().replace(/\.$/, "")

async function addresses(hostname: string) {
  const [v4, v6] = await Promise.all([
    lookup(() => resolver.resolve4(hostname)),
    lookup(() => resolver.resolve6(hostname)),
  ])
  return [...v4, ...v6]
}

export async function checkDomain(
  hostname: string,
  token: string
): Promise<DomainError | null> {
  try {
    const txt = await lookup(() =>
      resolver.resolveTxt(`${DOMAIN_CHALLENGE_PREFIX}.${hostname}`)
    )
    if (!txt.some((chunks) => chunks.join("").trim() === token)) {
      return "TXT_MISSING"
    }

    const cnames = await lookup(() => resolver.resolveCname(hostname))
    if (cnames.some((name) => sameName(name, customDomainTarget))) return null

    // An apex can't hold a CNAME: accept addresses that match the target's.
    const [own, target] = await Promise.all([
      addresses(hostname),
      addresses(customDomainTarget),
    ])
    if (own.length > 0 && own.every((address) => target.includes(address))) {
      return null
    }
    return "NOT_POINTED"
  } catch (error) {
    if (error instanceof LookupFailed) return "DNS_LOOKUP_FAILED"
    throw error
  }
}
