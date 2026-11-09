import { toast } from "@workspace/ui/components/ui/sonner"
import { isServer, QueryCache, QueryClient } from "@tanstack/react-query"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Above zero so data rendered on the server isn't refetched on mount.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      // Failed reads surface here once instead of in every component. Pass
      // `meta: { silent: true }` for background polls that should stay quiet.
      onError: (error, query) => {
        if (query.meta?.silent) return

        toast.error(error.message, {
          action: { label: "Retry", onClick: () => query.fetch() },
        })
      },
    }),
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
