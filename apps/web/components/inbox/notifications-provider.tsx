"use client"

import { useLocale } from "next-intl"
import { useEffect, type ReactNode } from "react"

import { useRefreshConversations } from "@/hooks/queries/conversation"
import {
  useRefreshNotifications,
  useSaveLocale,
} from "@/hooks/queries/notifications"
import { isLocale } from "@/i18n/locale"
import { serverUrl } from "@/lib/server-url"

/** Waits before reconnecting, doubling after each failure up to the max. */
const MIN_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/** Remembers, for this browser session, which language the server has. */
const SAVED_LOCALE_KEY = "notifications:saved-locale"

/**
 * Keeps the signed-in user's notifications live on every page: the feed,
 * the bell and conversations refresh the moment something new arrives. Also
 * tells the server which language to write their emails in.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  useLiveNotifications()
  useSaveLocaleOncePerSession()
  return children
}

/**
 * Listens to the API's notification stream. A new notification refreshes
 * the feed and conversations (a new message is one). The connection is
 * reopened after it drops, waiting longer each time, and everything is
 * refreshed on reconnect in case something arrived in between.
 */
function useLiveNotifications() {
  const refreshNotifications = useRefreshNotifications()
  const refreshConversations = useRefreshConversations()

  useEffect(() => {
    const refresh = () => {
      void refreshNotifications()
      void refreshConversations()
    }

    let source: EventSource | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let delay = MIN_RETRY_MS
    let connectedBefore = false
    let closed = false

    function connect() {
      source = new EventSource(`${serverUrl()}/notifications/stream`, {
        withCredentials: true,
      })
      source.addEventListener("notification", refresh)
      source.onopen = () => {
        if (connectedBefore) refresh()
        connectedBefore = true
        delay = MIN_RETRY_MS
      }
      // EventSource retries some failures by itself but gives up on others
      // (an error status); reconnecting by hand covers both the same way.
      source.onerror = () => {
        source?.close()
        if (closed) return
        retry = setTimeout(connect, delay)
        delay = Math.min(delay * 2, MAX_RETRY_MS)
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      source?.close()
    }
  }, [refreshNotifications, refreshConversations])
}

/** Saves the app's language for the user once per session, and on change. */
function useSaveLocaleOncePerSession() {
  const locale = useLocale()
  const { mutate } = useSaveLocale()

  useEffect(() => {
    if (!isLocale(locale) || readSession(SAVED_LOCALE_KEY) === locale) return
    mutate(locale, {
      onSuccess: () => writeSession(SAVED_LOCALE_KEY, locale),
    })
  }, [locale, mutate])
}

// Session storage can be unavailable (private mode, blocked storage): then
// the language is simply saved again on the next page load.
function readSession(key: string) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // See readSession.
  }
}
