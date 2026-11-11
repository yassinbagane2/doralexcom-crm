"use client"

import type { UserRole } from "@workspace/auth/roles"
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
import { ChevronsUpDown } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { LogoMark } from "@/components/logo"
import { UserAvatar } from "@/components/user-avatar"
import { homeRouteFor } from "@/config/routes"

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
          "flex items-center justify-between md:pt-3.5",
          collapsed ? "flex-col gap-3" : "flex-row"
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
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent className="gap-4 p-2">
        <NavigationRoutes role={role} isOwner={isOwner} />
      </SidebarContent>

      <SidebarFooter>
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
