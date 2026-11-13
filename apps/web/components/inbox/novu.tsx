"use client"

import { Inbox, InboxContent } from "@novu/nextjs"
import type { InboxProps } from "@novu/nextjs"
import { useNovu } from "@novu/nextjs/hooks"
import { dark } from "@novu/nextjs/themes"
import {
  AlarmClockOff,
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Ellipsis,
  Info,
  MailIcon,
  MessageSquare,
  Settings2,
  Smartphone,
  Trash2,
} from "@workspace/ui/icons"
import type { LucideIcon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect, useMemo, type ReactNode } from "react"

import { useRefreshConversations } from "@/hooks/queries/conversation"
import { useInboxSession } from "@/hooks/queries/inbox"

type Appearance = NonNullable<InboxProps["appearance"]>
type Localization = NonNullable<InboxProps["localization"]>

/*
 * Novu's colours point at the app's own tokens, so the inbox follows the
 * theme (and any later palette change) without a second copy of the colours.
 * Novu derives its shades with relative colour syntax, which accepts these.
 * The feed sits on the page's card, so it takes the card's colours.
 */
const VARIABLES: Appearance["variables"] = {
  colorBackground: "var(--card)",
  colorForeground: "var(--card-foreground)",
  colorPrimary: "var(--primary)",
  colorPrimaryForeground: "var(--primary-foreground)",
  colorSecondary: "var(--muted)",
  colorSecondaryForeground: "var(--muted-foreground)",
  colorCounter: "var(--destructive)",
  colorCounterForeground: "var(--destructive-foreground)",
  colorNeutral: "var(--border)",
  colorRing: "var(--ring)",
  colorShadow: "var(--foreground)",
  borderRadius: "var(--radius)",
  fontSize: "14px",
}

/*
 * Per-part classes, mirroring the app's own components: the feed is a
 * bordered panel like the app's lists, menus look like DropdownMenuContent,
 * action buttons like Button. Novu's stylesheet is unlayered, so it beats
 * Tailwind's layered utilities whatever their specificity; hence `!` on
 * every class that overrides a Novu style.
 */
const ELEMENTS: Appearance["elements"] = {
  root: "font-sans! h-full!",
  inboxContent: "h-full! bg-card!",
  inboxHeader: "border-b! border-border!",
  inboxStatus__title: "text-sm! font-semibold! text-foreground!",
  preferencesHeader: "border-b! border-border!",
  preferencesHeader__title: "text-sm! font-semibold! text-foreground!",

  // Notifications.
  notification: "transition-colors",
  notificationSubject: "text-sm! font-medium! text-foreground!",
  notificationBody: "text-sm! text-muted-foreground!",
  notificationDate: "text-xs! text-muted-foreground!",
  notificationDot: "bg-primary!",
  notificationPrimaryAction__button:
    "h-7! rounded-md! bg-primary! px-2.5! text-xs! font-medium! text-primary-foreground! shadow-none! hover:bg-primary/90!",
  notificationSecondaryAction__button:
    "h-7! rounded-md! border! border-border! bg-background! px-2.5! text-xs! font-medium! text-foreground! shadow-none! hover:bg-muted!",
  notificationListEmptyNotice: "text-sm! text-muted-foreground!",
  notificationListNewNotificationsNotice__button:
    "rounded-full! bg-primary! text-xs! font-medium! text-primary-foreground!",

  // Menus and tooltips: same as DropdownMenuContent and TooltipContent.
  dropdownContent:
    "rounded-md! border-0! bg-popover! p-1! text-popover-foreground! shadow-md! ring-1! ring-foreground/10!",
  dropdownItem:
    "rounded-sm! px-2! py-1.5! text-sm! hover:bg-accent! hover:text-accent-foreground!",
  tooltipContent:
    "rounded-md! bg-foreground! px-2! py-1! text-xs! text-background! shadow-none!",

  // Tabs.
  notificationsTabs__tabsTrigger: "text-sm! font-medium!",
  notificationsTabsTriggerCount: "bg-primary! text-primary-foreground!",
}

/** Novu's built-in icons swapped for the app's (Lucide), at Novu's size. */
function icon(Icon: LucideIcon) {
  return ({ class: className }: { class?: string }) => (
    <Icon className={cn("size-4", className)} strokeWidth={1.75} />
  )
}

const ICONS: Appearance["icons"] = {
  bell: icon(Bell),
  cogs: icon(Settings2),
  dots: icon(Ellipsis),
  arrowDown: icon(ChevronDownIcon),
  arrowDropDown: icon(ChevronDownIcon),
  arrowLeft: icon(ChevronLeftIcon),
  arrowRight: icon(ChevronRightIcon),
  check: icon(Check),
  clock: icon(ClockIcon),
  unsnooze: icon(AlarmClockOff),
  markAsRead: icon(Check),
  markAsUnread: icon(MailIcon),
  markAsArchived: icon(Archive),
  markAsArchivedRead: icon(Archive),
  markAsUnarchived: icon(ArchiveRestore),
  trash: icon(Trash2),
  info: icon(Info),
  inApp: icon(Bell),
  email: icon(MailIcon),
  sms: icon(Smartphone),
  push: icon(Smartphone),
  chat: icon(MessageSquare),
}

/** Whether Novu is set up on the server; undefined while asking. */
export function useNovuEnabled() {
  return useInboxSession().data?.enabled
}

/**
 * Connects the page to the user's Novu inbox, themed to match the app, for
 * the notification feed and live message updates below it. Without Novu set
 * up (NOVU_SECRET_KEY and NOVU_APPLICATION_IDENTIFIER) it renders its
 * children alone: messages still work, refreshed on an interval.
 */
export function NovuInbox({ children }: { children: ReactNode }) {
  const { data: session } = useInboxSession()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const localization = useInboxLocalization()

  const appearance = useMemo<Appearance>(
    () => ({
      // Covers what the variables don't; the variables win where both apply.
      baseTheme: resolvedTheme === "dark" ? dark : undefined,
      variables: VARIABLES,
      elements: ELEMENTS,
      icons: ICONS,
    }),
    [resolvedTheme]
  )

  if (!session?.enabled) return children

  return (
    <Inbox
      applicationIdentifier={session.applicationIdentifier}
      subscriber={session.subscriberId}
      subscriberHash={session.subscriberHash}
      backendUrl={session.backendUrl}
      socketUrl={session.socketUrl}
      appearance={appearance}
      localization={localization}
      routerPush={(path) => router.push(path)}
    >
      <RefreshOnNotification />
      {children}
    </Inbox>
  )
}

/**
 * Novu pushes each new notification over its socket; a new message is one,
 * so conversations refresh the moment it lands instead of on the next poll.
 */
function RefreshOnNotification() {
  const novu = useNovu()
  const refresh = useRefreshConversations()

  useEffect(
    () => novu.on("notifications.notification_received", () => void refresh()),
    [novu, refresh]
  )

  return null
}

/** Novu's notification feed, filling its container. Inside <NovuInbox>. */
export function NotificationFeed() {
  return <InboxContent />
}

/** Novu's built-in strings, in the active language. */
function useInboxLocalization(): Localization {
  const t = useTranslations("Inbox")
  // Novu formats dates with it (Intl), which takes the app's "en" / "ro".
  const locale = useLocale()

  return useMemo(
    () => ({
      locale,
      "inbox.filters.labels.default": t("inbox"),
      "inbox.filters.labels.unread": t("unread"),
      "inbox.filters.labels.archived": t("archived"),
      "inbox.filters.labels.snoozed": t("snoozed"),
      "inbox.filters.dropdownOptions.default": t("unreadAndRead"),
      "inbox.filters.dropdownOptions.unread": t("unreadOnly"),
      "inbox.filters.dropdownOptions.archived": t("archived"),
      "inbox.filters.dropdownOptions.snoozed": t("snoozed"),
      "notifications.emptyNotice": t("empty"),
      "notifications.actions.readAll": t("markAllRead"),
      "notifications.actions.archiveAll": t("archiveAll"),
      "notifications.actions.archiveRead": t("archiveRead"),
      "notifications.newNotifications": ({ notificationCount }) =>
        t("newNotifications", { count: notificationCount }),
      "notification.actions.read.tooltip": t("markRead"),
      "notification.actions.unread.tooltip": t("markUnread"),
      "notification.actions.archive.tooltip": t("archive"),
      "notification.actions.unarchive.tooltip": t("unarchive"),
      "notification.actions.snooze.tooltip": t("snooze"),
      "notification.actions.unsnooze.tooltip": t("unsnooze"),
      "notification.snoozedUntil": t("snoozedUntil"),
      "preferences.title": t("preferencesTitle"),
      "preferences.emptyNotice": t("preferencesEmpty"),
      "preferences.global": t("preferencesGlobal"),
      "snooze.options.anHourFromNow": t("snoozeAnHour"),
      "snooze.options.inOneDay": t("snoozeTomorrow"),
      "snooze.options.inOneWeek": t("snoozeNextWeek"),
      "snooze.options.customTime": t("snoozeCustom"),
      "snooze.datePicker.timePickerLabel": t("snoozeTime"),
      "snooze.datePicker.apply": t("snoozeApply"),
      "snooze.datePicker.cancel": t("snoozeCancel"),
      "snooze.datePicker.pastDateTooltip": t("snoozePastDate"),
      "snooze.datePicker.noDateSelectedTooltip": t("snoozeNoDate"),
      "snooze.datePicker.exceedingLimitTooltip": ({ days }) =>
        t("snoozeTooFar", { days }),
    }),
    [locale, t]
  )
}
