import { isServer, QueryClient } from "@tanstack/react-query"

/*
 * Failed reads and writes are toasted from one place, `RequestErrorToasts` in
 * components/providers.tsx, where the message can be translated. Pass
 * `meta: { silent: true }` to a query or mutation that should stay quiet.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Above zero so data rendered on the server isn't refetched on mount.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  // The server needs a fresh client per request so users never share a cache.
  if (isServer) {
    return makeQueryClient()
  }

  // The browser keeps one, so a render that suspends doesn't drop the cache.
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
