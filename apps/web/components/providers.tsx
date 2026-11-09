"use client"

import { QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { toast, Toaster } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { useErrorMessage } from "@/hooks/use-error-message"
import { getQueryClient } from "@/lib/query-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const t = useTranslations("Common")

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <RequestErrorToasts />
        <Toaster dismissLabel={t("dismiss")} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

/**
 * Every failed request ends up as an error toast, in the active language.
 * Listening to the caches here, rather than in each hook, means a new query
 * or mutation is covered without remembering to wire it up.
 */
function RequestErrorToasts() {
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const t = useTranslations("Common")

  useEffect(() => {
    const unsubscribeQueries = queryClient
      .getQueryCache()
      .subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return
        if (event.query.meta?.silent) return

        const { query } = event
        toast.error(errorMessage(event.action.error), {
          // One toast per query: a failed refetch replaces the last one.
          id: `query-${query.queryHash}`,
          action: { label: t("retry"), onClick: () => void query.fetch() },
        })
      })

    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return
        if (event.mutation.meta?.silent) return

        toast.error(errorMessage(event.action.error))
      })

    return () => {
      unsubscribeQueries()
      unsubscribeMutations()
    }
  }, [errorMessage, queryClient, t])

  return null
}
