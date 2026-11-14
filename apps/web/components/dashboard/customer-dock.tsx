"use client"

import type { UserRole } from "@workspace/auth/roles"
import {
  Dock,
  DockItem,
  DockSeparator,
} from "@workspace/ui/components/motion/dock"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"
import { Bell, Loader2, Logout } from "@workspace/ui/icons"
import Link from "next/link"
import { useTranslations } from "next-intl"
import type { ReactElement } from "react"

import { NotificationsPopover } from "@/components/inbox/notifications-popover"
import { useSignOut } from "@/hooks/queries/auth"
import { useUnreadNotificationCount } from "@/hooks/queries/notifications"

import { useDockRoutes, type RouteWithActive } from "./navigation"

const ICON_SIZE = 18

/**
 * The customers' navigation, a dock at the bottom of the screen: their home,
 * their messages, their notifications, their account pages, and signing out. Customers have too
 * few pages for a sidebar.
 */
export function CustomerDock({
  role,
  isOwner,
}: {
  role: UserRole
  isOwner: boolean
}) {
  const t = useTranslations("Navigation")
  const { pages, account } = useDockRoutes(role, isOwner)
  const signOut = useSignOut()

  return (
    <Dock>
      {pages.map((route) => (
        <RouteItem key={route.id} route={route} />
      ))}
      <NotificationsItem />
      <DockSeparator />
      {account.map((route) => (
        <RouteItem key={route.id} route={route} />
      ))}
      <DockSeparator />
      <DockItem>
        <Labelled label={t("signOut")}>
          <button
            type="button"
            aria-label={t("signOut")}
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
            className={ITEM_CLASS}
          >
            {signOut.isPending ? (
              <Loader2 size={ICON_SIZE} className="animate-spin" />
            ) : (
              <Logout size={ICON_SIZE} />
            )}
          </button>
        </Labelled>
      </DockItem>
    </Dock>
  )
}

const ITEM_CLASS =
  "flex size-full cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default aria-[current=page]:text-foreground"

const BADGE_CLASS =
  "absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"

/** The bell: the notification feed opens above the dock. */
function NotificationsItem() {
  const t = useTranslations("Inbox")
  const count = useUnreadNotificationCount().data ?? 0

  return (
    <DockItem>
      <Tooltip>
        <NotificationsPopover
          side="top"
          align="center"
          sideOffset={14}
          trigger={
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={t("notifications")}
                  className={`relative ${ITEM_CLASS}`}
                >
                  <Bell size={ICON_SIZE} />
                  {count > 0 ? (
                    <span
                      aria-label={t("unreadNotifications", { count })}
                      className={BADGE_CLASS}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </button>
              }
            />
          }
        />
        <TooltipContent side="top" sideOffset={10}>
          {t("notifications")}
        </TooltipContent>
      </Tooltip>
    </DockItem>
  )
}

function RouteItem({ route }: { route: RouteWithActive }) {
  const Icon = route.icon
  return (
    <DockItem active={route.isActive}>
      <Labelled label={route.title}>
        <Link
          href={route.link}
          aria-label={route.title}
          aria-current={route.isActive ? "page" : undefined}
          className={`relative ${ITEM_CLASS}`}
        >
          {Icon ? <Icon size={ICON_SIZE} /> : null}
          {route.badge ? (
            <span className={BADGE_CLASS}>
              {route.badge > 99 ? "99+" : route.badge}
            </span>
          ) : null}
        </Link>
      </Labelled>
    </DockItem>
  )
}

/** Names an icon-only item on hover and focus. */
function Labelled({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
