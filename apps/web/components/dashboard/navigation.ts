"use client"

import type { UserRole } from "@workspace/auth/roles"
import {
  Building2,
  BuildingOffice,
  Contact,
  FileText,
  Home,
  LayoutDashboard,
  Logout,
  UserCircle,
  Users,
} from "@workspace/ui/icons"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, type ComponentType } from "react"

import { matchesRoute, routes } from "@/config/routes"
import { useSignOut } from "@/hooks/queries/auth"

export type NavigationIcon = ComponentType<{
  size?: number
  color?: string
  className?: string
}>

type Condition = boolean | (() => boolean)

export type SubRoute = {
  readonly title: string
  readonly link: string
  readonly icon?: NavigationIcon
  readonly extra?: React.ReactNode
  readonly if?: Condition
}

export type Route = {
  readonly id: string
  readonly title: string
  readonly icon?: NavigationIcon
  readonly link: string
  readonly if?: boolean
  readonly subs?: SubRoute[]
  /** Overrides the default "the path starts with the link" check. */
  readonly checkIsActive?: (currentPath: string) => boolean
}

export type SubRouteWithActive = SubRoute & { readonly isActive: boolean }

export type RouteWithActive = Omit<Route, "subs"> & {
  readonly isActive: boolean
  readonly subs?: SubRouteWithActive[]
}

export type DropdownMenuRoute = {
  readonly id: string
  readonly title: string
  readonly icon?: NavigationIcon
  readonly if?: Condition
  readonly separatorBefore?: boolean
  readonly disabled?: boolean
} & (
  | { readonly href: string; readonly onClick?: never }
  | { readonly onClick: () => void; readonly href?: never }
)

type Translate = ReturnType<typeof useTranslations<"Navigation">>

const isAllowed = (condition: Condition | undefined) =>
  typeof condition === "undefined" ||
  (typeof condition === "function" ? condition() : condition)

/** Decodes each segment so links with encoded characters still match. */
const decodePathname = (pathname: string | null) => {
  if (!pathname) return ""
  return pathname
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join("/")
}

const applySubRouteIsActive =
  (path: string, parentRoute?: Route) =>
  (r: SubRoute): SubRouteWithActive => ({
    ...r,
    isActive:
      r.link === path ||
      (parentRoute?.link !== r.link && matchesRoute(path, r.link)),
  })

const applyIsActive =
  (path: string) =>
  (r: Route): RouteWithActive => ({
    ...r,
    isActive: r.checkIsActive
      ? r.checkIsActive(path)
      : matchesRoute(path, r.link),
    subs: r.subs?.map(applySubRouteIsActive(path, r)),
  })

export const useIsAccountPage = () => {
  const pathname = usePathname()
  return matchesRoute(pathname, routes.account)
}

const useResolveRoutes = (
  list: Route[],
  allowAll?: boolean
): RouteWithActive[] => {
  const path = decodePathname(usePathname())

  return useMemo(
    () =>
      list
        .filter((route) => allowAll || route.if !== false)
        .map((route) =>
          route.subs
            ? { ...route, subs: route.subs.filter((sub) => isAllowed(sub.if)) }
            : route
        )
        .map(applyIsActive(path)),
    [path, list, allowAll]
  )
}

/** The routes shown in the sidebar: the dashboard's, or the account pages'. */
export const useGeneralRoutes = (
  role: UserRole,
  allowAll?: boolean
): RouteWithActive[] => {
  const t = useTranslations("Navigation")
  const isAccountPage = useIsAccountPage()

  const list = useMemo(
    () =>
      isAccountPage ? accountRoutesList(role, t) : generalRoutesList(role, t),
    [role, t, isAccountPage]
  )

  return useResolveRoutes(list, allowAll)
}

/**
 * Where "back" on an account page leads: the first dashboard route the role
 * can open. Undefined when the role has no dashboard beyond its account.
 */
export const useDashboardHome = (role: UserRole) => {
  const t = useTranslations("Navigation")
  return useMemo(
    () => generalRoutesList(role, t).find((route) => route.if !== false)?.link,
    [role, t]
  )
}

export const useDropdownMenuRoutes = (role: UserRole): DropdownMenuRoute[] => {
  const t = useTranslations("Navigation")
  const signOut = useSignOut()
  const { mutate, isPending } = signOut

  return useMemo(
    () =>
      getDropdownMenuRoutes({
        role,
        t,
        signOut: () => mutate(),
        signingOut: isPending,
      }).filter((route) => isAllowed(route.if)),
    [role, t, mutate, isPending]
  )
}

const getDropdownMenuRoutes = (ctx: {
  role: UserRole
  t: Translate
  signOut: () => void
  signingOut: boolean
}): DropdownMenuRoute[] => {
  const { role, t, signOut, signingOut } = ctx

  return [
    {
      id: "organization",
      title: t("organization"),
      icon: BuildingOffice,
      // Only a business owns (and so can edit) an organization.
      if: role === "business",
      href: routes.accountOrganization,
    },
    {
      id: "profile",
      title: t("profile"),
      icon: UserCircle,
      href: routes.account,
    },
    {
      id: "sign-out",
      title: t("signOut"),
      icon: Logout,
      separatorBefore: true,
      disabled: signingOut,
      onClick: signOut,
    },
  ]
}

const generalRoutesList = (role: UserRole, t: Translate): Route[] => {
  const isAdmin = role === "admin"
  const isBusiness = role === "business"

  return [
    // Admin routes
    {
      id: "admin-home",
      title: t("home"),
      icon: LayoutDashboard,
      link: routes.admin,
      // The dashboard's root: anything deeper is another item.
      checkIsActive: (path) => path === routes.admin,
      if: isAdmin,
    },
    {
      id: "admin-users",
      title: t("users"),
      icon: Users,
      link: routes.adminUsers,
      if: isAdmin,
    },
    // Business routes
    {
      id: "users",
      title: t("users"),
      icon: Users,
      link: routes.users,
      if: isBusiness,
    },
    {
      id: "properties",
      title: t("properties"),
      icon: Building2,
      link: routes.properties,
      if: isBusiness,
    },
    {
      id: "tenants",
      title: t("tenants"),
      icon: Contact,
      link: routes.tenants,
      if: isBusiness,
    },
    {
      id: "templates",
      title: t("templates"),
      icon: FileText,
      link: routes.templates,
      if: isBusiness,
    },
    // User routes
    {
      id: "tenancy",
      title: t("tenancy"),
      icon: Home,
      link: routes.tenancy,
      if: role === "user",
    },
  ]
}

const accountRoutesList = (role: UserRole, t: Translate): Route[] => [
  {
    id: "profile",
    title: t("profile"),
    icon: UserCircle,
    link: routes.account,
    // Every account page sits under this one, so only an exact match counts.
    checkIsActive: (path) => path === routes.account,
  },
  {
    id: "organization",
    title: t("organization"),
    icon: BuildingOffice,
    link: routes.accountOrganization,
    if: role === "business",
  },
]
