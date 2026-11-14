"use client"

import {
  SNOOZE_MAX_DAYS,
  type NotificationFilter,
} from "@workspace/api/notification"
import type {
  NotificationPayload,
  NotificationType,
} from "@workspace/notifications/types"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/motion/tabs"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import {
  AlarmClockOff,
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  CheckCheck,
  ClockIcon,
  Ellipsis,
  MailIcon,
  Settings2,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"

import { InfiniteScrollTrigger } from "@/components/shared/infinite-scroll-trigger"
import { UserAvatar } from "@/components/shared/user-avatar"
import {
  useArchiveAllNotifications,
  useArchiveNotification,
  useArchiveReadNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotifications,
  useSnoozeNotification,
  useUnarchiveNotification,
  useUnreadNotificationCount,
  useUnsnoozeNotification,
  type NotificationItem,
} from "@/hooks/queries/notifications"
import { formatRelative } from "@/lib/format"

import { NotificationPreferences } from "./notification-preferences"

type Translate = ReturnType<typeof useTranslations<"Inbox">>

const FILTERS = [
  { value: "all", label: "inbox" },
  { value: "unread", label: "unread" },
  { value: "archived", label: "archived" },
  { value: "snoozed", label: "snoozed" },
] as const satisfies readonly {
  value: NotificationFilter
  label: Parameters<Translate>[0]
}[]

/** A notification as the feed shows it, and where clicking it leads. */
interface Shown {
  title: string
  body: string
  /** Whose initials stand beside it. */
  avatar: string
  path: string
}

/** How each notification type is shown; adding a type means adding it here. */
const SHOWN: {
  [T in NotificationType]: (
    payload: NotificationPayload<T>,
    t: Translate
  ) => Shown
} = {
  "new-message": (payload, t) => ({
    title: t("newMessageFrom", { sender: payload.senderName }),
    body: payload.preview,
    avatar: payload.senderName,
    path: payload.path,
  }),
}

/** Null for a type this version of the app doesn't know. */
function show(item: NotificationItem, t: Translate): Shown | null {
  if (!(item.type in SHOWN)) return null
  const render = SHOWN[item.type as NotificationType] as (
    payload: unknown,
    t: Translate
  ) => Shown
  return render(item.payload, t)
}

/** The bell, with how many notifications are unread. */
export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations("Inbox")
  const count = useUnreadNotificationCount().data ?? 0

  return (
    <span className={cn("relative inline-flex", className)}>
      <Bell className="size-4" />
      {count > 0 ? (
        <span
          aria-label={t("unreadNotifications", { count })}
          className="absolute -top-1.5 -right-2 h-4 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </span>
  )
}

/**
 * The notification feed, filling its container, with its preferences one
 * click away (the settings button).
 */
export function NotificationFeed() {
  const [preferences, setPreferences] = useState(false)

  return preferences ? (
    <NotificationPreferences onBack={() => setPreferences(false)} />
  ) : (
    <Feed onOpenPreferences={() => setPreferences(true)} />
  )
}

function Feed({ onOpenPreferences }: { onOpenPreferences: () => void }) {
  const t = useTranslations("Inbox")
  const [filter, setFilter] = useState<NotificationFilter>("all")
  const notifications = useNotifications(filter)
  const items = (notifications.data?.pages ?? []).flatMap((page) =>
    page.items.flatMap((item) => {
      const shown = show(item, t)
      return shown ? [{ item, shown }] : []
    })
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as NotificationFilter)}
          variant="segment"
        >
          <TabsList>
            {FILTERS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value} className="px-3 text-sm">
                {t(label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <FeedActions />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("preferencesTitle")}
            title={t("preferencesTitle")}
            className="text-muted-foreground hover:text-foreground"
            onClick={onOpenPreferences}
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notifications.isPending ? (
          <FeedSkeleton />
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Bell className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5 p-2">
            {items.map(({ item, shown }) => (
              <NotificationRow key={item.id} item={item} shown={shown} />
            ))}
            <InfiniteScrollTrigger query={notifications} />
          </ul>
        )}
      </div>
    </div>
  )
}

/** Mark all read, archive all, archive read: across the inbox. */
function FeedActions() {
  const t = useTranslations("Inbox")
  const markAllRead = useMarkAllNotificationsRead()
  const archiveAll = useArchiveAllNotifications()
  const archiveRead = useArchiveReadNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("feedActions")}
            title={t("feedActions")}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Ellipsis className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => markAllRead.mutate()}>
          <CheckCheck />
          {t("markAllRead")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => archiveAll.mutate()}>
          <Archive />
          {t("archiveAll")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => archiveRead.mutate()}>
          <Archive />
          {t("archiveRead")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One notification: opening it reads it and goes where it points. */
function NotificationRow({
  item,
  shown,
}: {
  item: NotificationItem
  shown: Shown
}) {
  const t = useTranslations("Inbox")
  const locale = useLocale()
  const router = useRouter()
  const markRead = useMarkNotificationRead()
  const unread = item.readAt === null
  const snoozed = item.snoozedUntil !== null && item.snoozedUntil > new Date()

  function open() {
    if (unread) markRead.mutate(item.id)
    router.push(shown.path)
  }

  return (
    <li className="relative">
      <button
        type="button"
        onClick={open}
        className="flex w-full items-start gap-3 rounded-xl py-3 pr-12 pl-3 text-left transition-colors hover:bg-muted/60"
      >
        <UserAvatar name={shown.avatar} className="size-9 text-xs" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "truncate text-sm",
              unread ? "font-semibold" : "font-medium"
            )}
          >
            {shown.title}
          </span>
          <span className="line-clamp-2 text-[13px] text-muted-foreground">
            {shown.body}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {snoozed
              ? `${t("snoozedUntil")} ${formatDateTime(item.snoozedUntil!, locale)}`
              : (formatRelative(item.createdAt, locale) ?? t("justNow"))}
          </span>
        </span>
        {unread ? (
          <span
            aria-label={t("unread")}
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          />
        ) : null}
      </button>
      <div className="absolute top-2.5 right-2">
        <NotificationMenu item={item} snoozed={snoozed} />
      </div>
    </li>
  )
}

/** Read or unread, snooze or wake, archive or restore one notification. */
function NotificationMenu({
  item,
  snoozed,
}: {
  item: NotificationItem
  snoozed: boolean
}) {
  const t = useTranslations("Inbox")
  const markRead = useMarkNotificationRead()
  const markUnread = useMarkNotificationUnread()
  const archive = useArchiveNotification()
  const unarchive = useUnarchiveNotification()
  const snooze = useSnoozeNotification()
  const unsnooze = useUnsnoozeNotification()
  const [pickingTime, setPickingTime] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("notificationActions")}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Ellipsis className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {item.readAt ? (
            <DropdownMenuItem onClick={() => markUnread.mutate(item.id)}>
              <MailIcon />
              {t("markUnread")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => markRead.mutate(item.id)}>
              <Check />
              {t("markRead")}
            </DropdownMenuItem>
          )}

          {snoozed ? (
            <DropdownMenuItem onClick={() => unsnooze.mutate(item.id)}>
              <AlarmClockOff />
              {t("unsnooze")}
            </DropdownMenuItem>
          ) : item.archivedAt ? null : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ClockIcon />
                {t("snooze")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {snoozePresets(new Date()).map(({ label, until }) => (
                  <DropdownMenuItem
                    key={label}
                    onClick={() => snooze.mutate({ id: item.id, until })}
                  >
                    {t(label)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPickingTime(true)}>
                  {t("snoozeCustom")}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {item.archivedAt ? (
            <DropdownMenuItem onClick={() => unarchive.mutate(item.id)}>
              <ArchiveRestore />
              {t("unarchive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => archive.mutate(item.id)}>
              <Archive />
              {t("archive")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SnoozeDialog
        open={pickingTime}
        onOpenChange={setPickingTime}
        onSnooze={(until) => snooze.mutate({ id: item.id, until })}
      />
    </>
  )
}

/** In an hour, tomorrow morning, next Monday morning. */
function snoozePresets(now: Date) {
  const morning = (daysAhead: number) => {
    const date = new Date(now)
    date.setDate(date.getDate() + daysAhead)
    date.setHours(9, 0, 0, 0)
    return date
  }
  const daysToMonday = (8 - now.getDay()) % 7 || 7

  return [
    { label: "snoozeAnHour", until: new Date(now.getTime() + 60 * 60 * 1000) },
    { label: "snoozeTomorrow", until: morning(1) },
    { label: "snoozeNextWeek", until: morning(daysToMonday) },
  ] as const
}

/** Snoozing needs a time at least this far ahead, so it isn't over at once. */
const MIN_SNOOZE_MS = 3 * 60 * 1000

/** A date and time of the user's choosing, up to SNOOZE_MAX_DAYS ahead. */
function SnoozeDialog({
  open,
  onOpenChange,
  onSnooze,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSnooze: (until: Date) => void
}) {
  const t = useTranslations("Inbox")
  const id = useId()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const now = new Date()
  const latest = new Date(now.getTime() + SNOOZE_MAX_DAYS * 24 * 60 * 60 * 1000)

  function apply() {
    const until = value ? new Date(value) : null
    if (!until || Number.isNaN(until.getTime())) {
      setError(t("snoozeNoDate"))
    } else if (until.getTime() < Date.now() + MIN_SNOOZE_MS) {
      setError(t("snoozePastDate"))
    } else if (until > latest) {
      setError(t("snoozeTooFar", { days: SNOOZE_MAX_DAYS }))
    } else {
      onSnooze(until)
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValue("")
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("snoozeCustom")}</DialogTitle>
        </DialogHeader>
        <form
          id={id}
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
        >
          <Label htmlFor={`${id}-until`}>{t("snoozeTime")}</Label>
          <Input
            id={`${id}-until`}
            type="datetime-local"
            value={value}
            min={toDateTimeInput(now)}
            max={toDateTimeInput(latest)}
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("snoozeCancel")}
          </Button>
          <Button type="submit" form={id}>
            {t("snoozeApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-3">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-2/5 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function formatDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

/** `date` in local time, as a datetime-local input wants it. */
function toDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
