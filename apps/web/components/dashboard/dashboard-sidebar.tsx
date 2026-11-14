"use client"

import type { UserRole } from "@workspace/auth/roles"
import { Button } from "@workspace/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/ui/sidebar"
import { Bell, ChevronsUpDown } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { NotificationsPopover } from "@/components/inbox/notifications-popover"
import { LogoMark } from "@/components/shared/logo"
import { UserAvatar } from "@/components/shared/user-avatar"
import { homeRouteFor } from "@/config/routes"
import { useUnreadNotificationCount } from "@/hooks/queries/notifications"

import { DropdownMenuRoutes, NavigationRoutes } from "./dashboard-navigation"

export function DashboardSidebar({
  role,
  isOwner,
  name,
  email,
}: {
  role: UserRole
  isOwner: boolean
  name: string
  email: string
}) {
  const t = useTranslations("Navigation")
  const tCommon = useTranslations("Common")
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  // Admins run the platform, so they get a badge next to the name.
  const subtitle = role === "admin" ? t("adminBadge") : undefined

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={cn(
          "flex items-center justify-between",
          collapsed ? "flex-col gap-3" : "flex-row md:px-0"
        )}
      >
        <Link
          href={homeRouteFor(role)}
          aria-label={tCommon("appName")}
          className={cn(
            "flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight",
            collapsed ? "justify-center" : "px-2"
          )}
        >
          <LogoMark size={collapsed ? 22 : 24} />
          {collapsed ? null : (
            <span className="truncate">
              {tCommon("appName")}
              {subtitle ? (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {subtitle}
                </span>
              ) : null}
            </span>
          )}
        </Link>
        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-1" : "gap-0.5"
          )}
        >
          {/* Admins run the platform and get no notifications. */}
          {role === "admin" ? null : <Notifications />}
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("gap-4 p-2", !collapsed && "md:px-0")}>
        <NavigationRoutes role={role} isOwner={isOwner} />
      </SidebarContent>

      <SidebarFooter className={cn(!collapsed && "md:p-0")}>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" aria-label={t("openMenu")} />
                }
              >
                <UserAvatar name={name} />
                {collapsed ? null : (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col text-left">
                      <span className="truncate text-sm font-medium">
                        {name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {email}
                      </span>
                    </span>
                    <ChevronsUpDown className="size-4 text-muted-foreground" />
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-60">
                <div className="flex flex-col px-2 py-1.5">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuRoutes role={role} isOwner={isOwner} />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/** The bell beside the sidebar's toggle: the feed opens under it. */
function Notifications() {
  const t = useTranslations("Inbox")
  const { setOpenMobile } = useSidebar()
  const count = useUnreadNotificationCount().data ?? 0

  return (
    <NotificationsPopover
      side="bottom"
      align="start"
      onNavigate={() => setOpenMobile(false)}
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("notifications")}
          title={t("notifications")}
          className="relative"
        >
          <Bell />
          {count > 0 ? (
            <span
              aria-label={t("unreadNotifications", { count })}
              className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-sidebar"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      }
    />
  )
}
