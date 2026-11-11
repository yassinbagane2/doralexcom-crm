"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { useTranslations } from "next-intl"
import { useRef } from "react"

import { useOnVisible } from "@/hooks/use-on-visible"

/** The part of an infinite query the trigger relies on; any `useInfiniteQuery` result fits. */
export interface InfiniteScrollSource {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => unknown
}

/**
 * Goes after the last item of an infinite list and fetches the next page when
 * it scrolls into view. A failed page stops it (a visible trigger would
 * otherwise retry in a loop) and shows a manual retry instead. Loading
 * placeholders stay with the list itself.
 */
export function InfiniteScrollTrigger({
  query,
}: {
  query: InfiniteScrollSource
}) {
  const t = useTranslations("Common")
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = query
  const ref = useRef<HTMLDivElement>(null)
  useOnVisible(
    ref,
    () => fetchNextPage(),
    hasNextPage && !isFetchingNextPage && !isFetchNextPageError
  )

  return (
    <>
      {isFetchNextPageError ? (
        <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
          <span>{t("loadMoreFailed")}</span>
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            {t("retry")}
          </Button>
        </div>
      ) : null}
      <div ref={ref} aria-hidden className="h-px shrink-0" />
    </>
  )
}
