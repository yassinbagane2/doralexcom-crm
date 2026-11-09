import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import type { AppRouterClient } from "@workspace/api/routers"

import { env } from "@/env"

const link = new RPCLink({
  url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  // In the browser the cookie travels on its own. During server rendering
  // there is no browser, so forward the incoming request's cookie by hand.
  headers: async () => {
    if (typeof window !== "undefined") {
      return {}
    }

    const { headers } = await import("next/headers")
    const cookie = (await headers()).get("cookie")
    return cookie ? { cookie } : {}
  },
})

/** Typed client for the API server's oRPC routers. */
export const client: AppRouterClient = createORPCClient(link)

/** Query and mutation options for each procedure, e.g. `orpc.user.overview`. */
export const orpc = createTanstackQueryUtils(client)
