"use client"

import { Bell as NovuBell, Inbox, InboxContent } from "@novu/nextjs"
import type { InboxProps } from "@novu/nextjs"
import { dark } from "@novu/nextjs/themes"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover"
import { Bell } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useMemo, useState } from "react"

import { useInboxSession } from "@/hooks/queries/inbox"

type Appearance = NonNullable<InboxProps["appearance"]>
type Localization = NonNullable<InboxProps["localization"]>

/*
 * Novu's colours point at the app's own tokens, so the inbox follows the
 * theme (and any later palette change) without a second copy of the colours.
 * Novu derives its shades with relative colour syntax, which accepts these.
 */
const VARIABLES: Appearance["variables"] = {
  colorBackground: "var(--popover)",
  colorForeground: "var(--popover-foreground)",
  colorPrimary: "var(--primary)",
  colorPrimaryForeground: "var(--primary-foreground)",
  colorSecondary: "var(--muted)",
  colorSecondaryForeground: "var(--muted-foreground)",
  colorCounter: "var(--destructive)",
  colorCounterForeground: "var(--destructive-foreground)",
  colorNeutral: "var(--border)",
  colorRing: "var(--ring)",
  borderRadius: "var(--radius)",
  fontSize: "14px",
}

/**
 * The bell and the user's Novu notification feed, in the app's own popover.
 * Renders nothing until the server says Novu is set up, so environments
 * without Novu keys simply have no bell.
 */
export function InboxBell({
  side = "bottom",
  align = "start",
  className,
}: {
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  className?: string
}) {
  const { data: session } = useInboxSession()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const localization = useInboxLocalization()
  const t = useTranslations("Inbox")
  const [open, setOpen] = useState(false)

  const appearance = useMemo<Appearance>(
    () => ({
      // Covers what the variables don't (shadows, hover tints); the
      // variables still win where both set something.
      baseTheme: resolvedTheme === "dark" ? dark : undefined,
      variables: VARIABLES,
    }),
    [resolvedTheme]
  )

  if (!session?.enabled) return null

  return (
    <Inbox
      applicationIdentifier={session.applicationIdentifier}
      subscriber={session.subscriberId}
      subscriberHash={session.subscriberHash}
      backendUrl={session.backendUrl}
      socketUrl={session.socketUrl}
      appearance={appearance}
      localization={localization}
      routerPush={(path) => {
        setOpen(false)
        router.push(path)
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <NovuBell
          renderBell={(unread) => (
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    "relative rounded-full text-muted-foreground",
                    className
                  )}
                  aria-label={
                    unread.total > 0
                      ? t("openWithUnread", { count: unread.total })
                      : t("open")
                  }
                />
              }
            >
              <Bell className="size-4" />
              {unread.total > 0 ? (
                <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-none font-semibold text-white tabular-nums">
                  {unread.total > 99 ? "99+" : unread.total}
                </span>
              ) : null}
            </PopoverTrigger>
          )}
        />
        <PopoverContent
          side={side}
          align={align}
          sideOffset={8}
          className="h-[min(560px,var(--available-height))] w-[min(400px,calc(100vw-1rem))] overflow-hidden p-0"
        >
          <InboxContent />
        </PopoverContent>
      </Popover>
    </Inbox>
  )
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
