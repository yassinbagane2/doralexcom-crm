"use client"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  AdjustmentsHorizontalIcon,
  ChevronsUpDown,
  LayoutDashboard,
  Logout,
  ShieldCheck,
  UserCircle,
  Users,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { HeaderControls } from "@/components/header-controls"
import { UserAvatar } from "@/components/user-avatar"
import { matchesRoute, routes } from "@/config/routes"
import { useSignOut } from "@/hooks/queries/auth"

const NAV = [
  {
    href: routes.admin,
    label: "home",
    icon: LayoutDashboard,
    // The home page is the dashboard's root: anything deeper is another item.
    isActive: (path: string) => path === routes.admin,
  },
  {
    href: routes.adminUsers,
    label: "users",
    icon: Users,
    isActive: (path: string) => matchesRoute(path, routes.adminUsers),
  },
] as const

export function AdminSidebar({ name, email }: { name: string; email: string }) {
  const t = useTranslations("AdminNav")
  const tCommon = useTranslations("Common")
  const pathname = usePathname()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={cn(
          "flex items-center justify-between md:pt-3.5",
          collapsed ? "flex-col gap-3" : "flex-row"
        )}
      >
        <Link
          href={routes.admin}
          className="truncate px-2 text-sm font-semibold"
        >
          {collapsed ? tCommon("appName").slice(0, 1) : tCommon("appName")}
          {collapsed ? null : (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {t("badge")}
            </span>
          )}
        </Link>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {NAV.map(({ href, label, icon: Icon, isActive }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                tooltip={t(label)}
                isActive={isActive(pathname)}
                render={<Link href={href} />}
              >
                <Icon size={16} />
                <span>{t(label)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        {collapsed ? null : <HeaderControls />}
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu name={name} email={email} collapsed={collapsed} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function AccountMenu({
  name,
  email,
  collapsed,
}: {
  name: string
  email: string
  collapsed: boolean
}) {
  const t = useTranslations("UserMenu")
  const signOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" aria-label={t("open")} />}
      >
        <UserAvatar name={name} />
        {collapsed ? null : (
          <>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuItem render={<Link href={routes.account} />}>
          <UserCircle size={16} />
          {t("account")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={routes.accountSecurity} />}>
          <ShieldCheck size={16} />
          {t("security")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={routes.accountPreferences} />}>
          <AdjustmentsHorizontalIcon size={16} />
          {t("preferences")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <Logout size={16} color="currentColor" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
