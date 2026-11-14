"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"
import { inFilter, type NotificationFilter } from "@workspace/api/notification"
import type { NotificationLocale } from "@workspace/notifications/types"
import { useCallback } from "react"

import { orpc } from "@/lib/orpc"

/*
 * The signed-in user's notification feed. New notifications arrive over the
 * live stream (components/inbox/notifications-provider.tsx), which refreshes
 * these queries. Read, archive and snooze show at once: the cached views are
 * updated before the server answers, and put back if it refuses.
 */

type FeedPage = Awaited<ReturnType<typeof orpc.notification.list.call>>

export type NotificationItem = FeedPage["items"][number]

export type NotificationPreference = Awaited<
  ReturnType<typeof orpc.notification.getPreferences.call>
>[number]

/** One view of the feed, a page at a time as the reader scrolls. */
export function useNotifications(filter: NotificationFilter) {
  return useInfiniteQuery({
    ...orpc.notification.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ filter, cursor }),
      initialPageParam: undefined,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    }),
    // Read by the optimistic updates below, to know what each view keeps.
    meta: { filter },
  })
}

/** Unread notifications in the inbox: the bell's badge. */
export function useUnreadNotificationCount() {
  return useQuery({
    ...orpc.notification.unreadCount.queryOptions(),
    meta: { silent: true },
  })
}

/** Refreshes the feed's views and the badge. */
export function useRefreshNotifications() {
  const queryClient = useQueryClient()
  return useCallback(() => refreshFeed(queryClient), [queryClient])
}

function refreshFeed(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.notification.list.key() }),
    queryClient.invalidateQueries({
      queryKey: orpc.notification.unreadCount.key(),
    }),
  ])
}

/** How a mutation changes each cached notification it touches. */
type Change = (item: NotificationItem) => NotificationItem

/**
 * A feed mutation shown before the server answers: `change` is applied to
 * every cached view, each view drops what no longer belongs in it, and the
 * badge moves by however many notifications became read or unread.
 */
function useFeedMutation<Input>(
  mutationFn: (input: Input) => Promise<unknown>,
  change: (input: Input, now: Date) => Change
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: orpc.notification.key() })

      const now = new Date()
      const apply = change(input, now)
      const countKey = orpc.notification.unreadCount.queryKey()
      const views = queryClient
        .getQueryCache()
        .findAll({ queryKey: orpc.notification.list.key() })
      const snapshot = {
        count: queryClient.getQueryData<number>(countKey),
        views: views.map((view) => ({
          key: view.queryKey,
          filter: view.meta?.filter as NotificationFilter | undefined,
          data: view.state.data as InfiniteData<FeedPage> | undefined,
        })),
      }

      // Each notification once, however many views hold it.
      const touched = new Map<string, [NotificationItem, NotificationItem]>()
      for (const { key, filter, data } of snapshot.views) {
        if (!data || !filter) continue
        queryClient.setQueryData<InfiniteData<FeedPage>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.flatMap((item) => {
              const next = apply(item)
              if (next !== item) touched.set(item.id, [item, next])
              return inFilter(filter, next, now) ? [next] : []
            }),
          })),
        })
      }

      if (snapshot.count !== undefined) {
        let delta = 0
        for (const [before, after] of touched.values()) {
          delta +=
            Number(inFilter("unread", after, now)) -
            Number(inFilter("unread", before, now))
        }
        queryClient.setQueryData(countKey, Math.max(0, snapshot.count + delta))
      }

      return snapshot
    },
    onError: (_error, _input, snapshot) => {
      if (!snapshot) return
      for (const { key, data } of snapshot.views) {
        queryClient.setQueryData(key, data)
      }
      queryClient.setQueryData(
        orpc.notification.unreadCount.queryKey(),
        snapshot.count
      )
    },
    onSettled: () => refreshFeed(queryClient),
  })
}

/** Changes the one notification with `id`, leaving the rest alone. */
function only(id: string, fields: Partial<NotificationItem>): Change {
  return (item) => (item.id === id ? { ...item, ...fields } : item)
}

/** Changes every notification of `filter`'s view. */
function every(
  filter: NotificationFilter,
  now: Date,
  fields: Partial<NotificationItem>,
  also: (item: NotificationItem) => boolean = () => true
): Change {
  return (item) =>
    inFilter(filter, item, now) && also(item) ? { ...item, ...fields } : item
}

export function useMarkNotificationRead() {
  return useFeedMutation(
    (id: string) => orpc.notification.markRead.call({ id }),
    (id, now) => only(id, { readAt: now })
  )
}

export function useMarkNotificationUnread() {
  return useFeedMutation(
    (id: string) => orpc.notification.markUnread.call({ id }),
    (id) => only(id, { readAt: null })
  )
}

export function useArchiveNotification() {
  return useFeedMutation(
    (id: string) => orpc.notification.archive.call({ id }),
    (id, now) => only(id, { archivedAt: now })
  )
}

export function useUnarchiveNotification() {
  return useFeedMutation(
    (id: string) => orpc.notification.unarchive.call({ id }),
    (id) => only(id, { archivedAt: null })
  )
}

export function useSnoozeNotification() {
  return useFeedMutation(
    (input: { id: string; until: Date }) =>
      orpc.notification.snooze.call(input),
    ({ id, until }) => only(id, { snoozedUntil: until })
  )
}

export function useUnsnoozeNotification() {
  return useFeedMutation(
    (id: string) => orpc.notification.unsnooze.call({ id }),
    (id) => only(id, { snoozedUntil: null })
  )
}

export function useMarkAllNotificationsRead() {
  return useFeedMutation(
    () => orpc.notification.markAllRead.call(),
    (_input: void, now) => every("unread", now, { readAt: now })
  )
}

export function useArchiveAllNotifications() {
  return useFeedMutation(
    () => orpc.notification.archiveAll.call(),
    (_input: void, now) => every("all", now, { archivedAt: now })
  )
}

export function useArchiveReadNotifications() {
  return useFeedMutation(
    () => orpc.notification.archiveRead.call(),
    (_input: void, now) =>
      every("all", now, { archivedAt: now }, (item) => item.readAt !== null)
  )
}

/** Which channels each notification type reaches the user on. */
export function useNotificationPreferences() {
  return useQuery(orpc.notification.getPreferences.queryOptions())
}

/** Turns a type on or off on a channel; the switch moves at once. */
export function useSetNotificationPreference() {
  const queryClient = useQueryClient()
  const key = orpc.notification.getPreferences.queryKey()

  return useMutation({
    mutationFn: (input: {
      type: NotificationPreference["type"]
      channel: keyof NotificationPreference["channels"]
      enabled: boolean
    }) => orpc.notification.setPreference.call(input),
    onMutate: async ({ type, channel, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<NotificationPreference[]>(key)
      queryClient.setQueryData<NotificationPreference[]>(key, (preferences) =>
        preferences?.map((preference) =>
          preference.type === type
            ? {
                ...preference,
                channels: { ...preference.channels, [channel]: enabled },
              }
            : preference
        )
      )
      return { previous }
    },
    onError: (_error, _input, context) =>
      queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Saves the language the user reads the app in, for their emails. */
export function useSaveLocale() {
  return useMutation({
    mutationFn: (locale: NotificationLocale) =>
      orpc.notification.setLocale.call({ locale }),
    // Runs on its own in the background: not worth a toast.
    meta: { silent: true },
  })
}
