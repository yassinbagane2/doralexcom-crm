"use client"

import type { UserRole } from "@workspace/auth/roles"
import {
  HoverHighlight,
  useHoverHighlight,
} from "@workspace/ui/components/motion/hover-highlight"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@workspace/ui/components/ui/sidebar"
import { ArrowLeftIcon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Fragment } from "react"

import {
  useDashboardHome,
  useDropdownMenuRoutes,
  useGeneralRoutes,
  useIsAccountPage,
} from "./navigation"

export function NavigationRoutes({ role }: { role: UserRole }) {
  const t = useTranslations("Navigation")
  const isAccountPage = useIsAccountPage()
  const dashboardHome = useDashboardHome(role)
  const dashboardRoutes = useGeneralRoutes(role)
  const { containerProps, getTargetProps, rect } = useHoverHighlight()

  return (
    <div {...containerProps} className="relative isolate w-full">
      <HoverHighlight rect={rect} className="rounded-lg bg-sidebar-accent" />
      <nav aria-label={t("label")}>
        <SidebarMenu>
          {isAccountPage && dashboardHome ? (
            <SidebarMenuItem className="mb-4">
              <SidebarMenuButton
                tooltip={t("backToDashboard")}
                className="hover:bg-transparent"
                render={<Link href={dashboardHome} />}
                {...getTargetProps()}
              >
                <ArrowLeftIcon className="size-4" />
                <span className="ml-2 text-sm font-medium">
                  {t("accountSettings")}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          {dashboardRoutes.map((route) => {
            const hasSubs = Boolean(route.subs && route.subs.length > 0)
            const Icon = route.icon

            return (
              <SidebarMenuItem key={route.id}>
                <SidebarMenuButton
                  tooltip={route.title}
                  isActive={route.isActive && !hasSubs}
                  className="rounded-lg text-sidebar-foreground transition-colors hover:bg-transparent"
                  render={
                    <Link
                      href={route.link}
                      prefetch
                      aria-current={
                        route.isActive && !hasSubs ? "page" : undefined
                      }
                    />
                  }
                  {...getTargetProps()}
                >
                  {Icon ? (
                    <span className="flex size-4 shrink-0 items-center justify-center overflow-visible text-muted-foreground">
                      <Icon size={16} color="currentColor" />
                    </span>
                  ) : null}
                  <span className="ml-2 text-sm font-medium">{route.title}</span>
                </SidebarMenuButton>
                {route.isActive && route.subs ? (
                  <SidebarMenuSub className="my-1 gap-y-0.5 pr-0">
                    {route.subs.map((subRoute) => {
                      const SubIcon = subRoute.icon

                      return (
                        <SidebarMenuSubItem key={subRoute.link}>
                          <Link
                            href={subRoute.link}
                            prefetch
                            aria-current={subRoute.isActive ? "page" : undefined}
                            {...getTargetProps(0.6)}
                            className={cn(
                              "flex w-full flex-row items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors",
                              subRoute.isActive &&
                                "bg-sidebar-accent text-sidebar-accent-foreground"
                            )}
                          >
                            {SubIcon ? (
                              <SubIcon size={16} color="currentColor" />
                            ) : null}
                            <span className="truncate">{subRoute.title}</span>
                            {subRoute.extra}
                          </Link>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </nav>
    </div>
  )
}

/** The account menu's items. Render inside a DropdownMenuContent. */
export function DropdownMenuRoutes({ role }: { role: UserRole }) {
  const routes = useDropdownMenuRoutes(role)

  return (
    <>
      {routes.map((route) => {
        const Icon = route.icon
        const content = (
          <>
            {Icon ? <Icon size={16} color="currentColor" /> : null}
            {route.title}
          </>
        )

        return (
          <Fragment key={route.id}>
            {route.separatorBefore ? <DropdownMenuSeparator /> : null}
            {route.href ? (
              <DropdownMenuItem
                disabled={route.disabled}
                render={<Link href={route.href} />}
              >
                {content}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={route.disabled}
                onClick={route.onClick}
              >
                {content}
              </DropdownMenuItem>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
