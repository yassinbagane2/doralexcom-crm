"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"

import { orpc } from "@/lib/orpc"

/*
 * Business ↔ customer messages. New ones arrive over the live notification
 * stream (components/inbox/notifications-provider.tsx refetches these on each
 * notification); the interval is the fallback while the stream is down.
 */
const REFETCH_INTERVAL = 30_000

export type ConversationSummary = Awaited<
  ReturnType<typeof orpc.conversation.list.call>
>[number]

export type MyConversation = Awaited<
  ReturnType<typeof orpc.conversation.mine.call>
>[number]

export type Message = Awaited<
  ReturnType<typeof orpc.conversation.messages.call>
>["messages"][number]

/** The business's conversations, most recent first. */
export function useConversations(search: string) {
  return useQuery({
    ...orpc.conversation.list.queryOptions({
      input: { search: search || undefined },
    }),
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
  })
}

/** The customer's conversations, one per business they belong to. */
export function useMyConversations() {
  return useQuery({
    ...orpc.conversation.mine.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  })
}

/** Who a conversation is with. */
export function useConversation(conversationId: string) {
  return useQuery(
    orpc.conversation.get.queryOptions({ input: { conversationId } })
  )
}

/** Its messages: the latest page first, older pages as the reader scrolls up. */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    ...orpc.conversation.messages.infiniteOptions({
      input: (before: string | undefined) => ({ conversationId, before }),
      initialPageParam: undefined,
      getNextPageParam: (page) =>
        page.hasMore ? page.messages[0]?.id : undefined,
    }),
    refetchInterval: REFETCH_INTERVAL,
  })
}

/** Conversations with something unread: the badge on the Inbox link. */
export function useUnreadConversations(enabled: boolean) {
  return useQuery({
    ...orpc.conversation.unreadCount.queryOptions(),
    enabled,
    refetchInterval: REFETCH_INTERVAL,
    meta: { silent: true },
  })
}

/** Refreshes every conversation query: lists, threads and the badge. */
export function useRefreshConversations() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: orpc.conversation.key() }),
    [queryClient]
  )
}

export function useSendMessage(conversationId: string) {
  const refresh = useRefreshConversations()
  return useMutation({
    mutationFn: (body: string) =>
      orpc.conversation.send.call({ conversationId, body }),
    onSuccess: refresh,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) =>
      orpc.conversation.markRead.call({ conversationId }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.conversation.list.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.conversation.mine.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.conversation.unreadCount.key(),
        }),
      ]),
    // Runs on its own whenever a thread is read: not worth a toast.
    meta: { silent: true },
  })
}

/** The conversation with one of the business's customers, started if new. */
export function useOpenConversation() {
  return useMutation({
    mutationFn: (customerId: string) =>
      orpc.conversation.open.call({ customerId }),
  })
}
