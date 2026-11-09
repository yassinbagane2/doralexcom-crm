import { auth } from "@workspace/auth"

/**
 * Built once per request by the server. Takes plain headers rather than a
 * Hono context so routers stay independent of the HTTP framework.
 */
export async function createContext({ headers }: { headers: Headers }) {
  const session = await auth.api.getSession({ headers })
  return { headers, session }
}

export type Context = Awaited<ReturnType<typeof createContext>>
