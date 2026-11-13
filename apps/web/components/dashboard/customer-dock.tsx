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
import { Loader2, Logout } from "@workspace/ui/icons"
import Link from "next/link"
import { useTranslations } from "next-intl"
import type { ReactElement } from "react"

import { InboxBell } from "@/components/inbox/inbox-bell"
import { useSignOut } from "@/hooks/queries/auth"
import { useInboxSession } from "@/hooks/queries/inbox"

import { useDockRoutes, type RouteWithActive } from "./navigation"

const ICON_SIZE = 18

/**
 * The customers' navigation, a dock at the bottom of the screen: their home,
 * their account pages, and signing out. Customers have too few pages for a
 * sidebar.
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
  // Only makes room for the bell when Novu is set up on the server.
  const inbox = useInboxSession()

  return (
    <Dock>
      {pages.map((route) => (
        <RouteItem key={route.id} route={route} />
      ))}
      <DockSeparator />
      {account.map((route) => (
        <RouteItem key={route.id} route={route} />
      ))}
      {inbox.data?.enabled ? (
        <DockItem>
          <InboxBell
            side="top"
            align="center"
            className="size-full hover:bg-transparent"
          />
        </DockItem>
      ) : null}
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

function RouteItem({ route }: { route: RouteWithActive }) {
  const Icon = route.icon
  return (
    <DockItem active={route.isActive}>
      <Labelled label={route.title}>
        <Link
          href={route.link}
          aria-label={route.title}
          aria-current={route.isActive ? "page" : undefined}
          className={ITEM_CLASS}
        >
          {Icon ? <Icon size={ICON_SIZE} /> : null}
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
