"use client"

import { useQuery } from "@tanstack/react-query"

import { orpc } from "@/lib/orpc"

export type DashboardOverview = Awaited<
  ReturnType<typeof orpc.dashboard.overview.call>
>

/**
 * Everything the business dashboard shows, as of the reader's `today`. It
 * sums up leases, payments, properties and documents alike, so rather than
 * have every mutation invalidate it, it refetches each time it's opened.
 */
export function useDashboardOverview(today: string) {
  return useQuery({
    ...orpc.dashboard.overview.queryOptions({ input: { today } }),
    staleTime: 0,
  })
}
