"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  AdjustmentsHorizontalIcon,
  BuildingOffice,
  Logout,
  ShieldCheck,
  UserCircle,
} from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import Link from "next/link"

import { UserAvatar } from "@/components/user-avatar"
import { routes } from "@/config/routes"
import { useSignOut } from "@/hooks/queries/auth"

export function UserMenu({ name, email }: { name: string; email: string }) {
  const t = useTranslations("UserMenu")
  const signOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("open")}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={name} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="flex flex-col px-2 py-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={routes.account} />}>
          <UserCircle size={16} />
          {t("account")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={routes.accountSecurity} />}>
          <ShieldCheck size={16} />
          {t("security")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={routes.accountOrganization} />}>
          <BuildingOffice size={16} />
          {t("organization")}
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
