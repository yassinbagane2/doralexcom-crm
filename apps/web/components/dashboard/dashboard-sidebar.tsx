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

import { UserAvatar } from "@/components/user-avatar"
import { homeRouteFor } from "@/config/routes"

import { DropdownMenuRoutes, NavigationRoutes } from "./dashboard-navigation"

export function DashboardSidebar({
  role,
  name,
  email,
  organizationName,
}: {
  role: UserRole
  name: string
  email: string
  organizationName?: string
}) {
  const t = useTranslations("Navigation")
  const tCommon = useTranslations("Common")
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  // Admins run the platform; everyone else works inside an organization.
  const subtitle = role === "admin" ? t("adminBadge") : organizationName

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
          className="min-w-0 truncate px-2 text-sm font-semibold"
        >
          {collapsed ? tCommon("appName").slice(0, 1) : tCommon("appName")}
          {collapsed || !subtitle ? null : (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {subtitle}
            </span>
          )}
        </Link>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent className="gap-4 p-2">
        <NavigationRoutes role={role} />
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
                <DropdownMenuRoutes role={role} />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
