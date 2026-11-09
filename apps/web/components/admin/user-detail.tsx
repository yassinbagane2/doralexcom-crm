"use client"

import { getUserRole } from "@workspace/auth/roles"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/motion/tabs"
import { Button } from "@workspace/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  ArrowTurnLeft,
  BuildingOffice,
  Calendar,
  Clock,
  DotsHorizontal,
  HandRaised,
  Lock,
  Logout,
  Mail,
  ShieldCheck,
  Trash,
} from "@workspace/ui/icons"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { BanUserDialog } from "@/components/admin/ban-user-dialog"
import {
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/admin/dashboard"
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"
import { RoleBadge } from "@/components/admin/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { routes } from "@/config/routes"
import {
  useAdminUser,
  useAdminUserOrganizations,
  useAdminUserSessions,
  useRevokeUserSessions,
  useUnbanUser,
  type AdminSession,
  type AdminUser,
} from "@/hooks/queries/admin"
import { formatDate, formatRelative } from "@/lib/format"
import { parseUserAgent } from "@/lib/user-agent"

export function UserDetail({
  initialUser,
  initialSessions,
}: {
  initialUser: AdminUser
  initialSessions: AdminSession[]
}) {
  const t = useTranslations("AdminUser")
  const locale = useLocale()
  const { data: user } = useAdminUser(initialUser.id, initialUser)
  const { data: sessions } = useAdminUserSessions(user.id, initialSessions)

  const role = getUserRole(user.role)
  const isBanned = Boolean(user.banned)
  const lastSeen =
    sessions.length > 0
      ? new Date(
          Math.max(...sessions.map((s) => new Date(s.updatedAt).getTime()))
        )
      : null

  const relative = (date: Date | string) =>
    formatRelative(date, locale) ?? t("justNow")

  return (
    <>
      <div className="flex w-full flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar name={user.name} className="size-12 text-sm" />
          <div className="flex min-w-0 flex-col">
            <p className="flex items-center gap-2 text-lg font-medium">
              <span className="truncate">{user.name}</span>
              <RoleBadge role={role} />
            </p>
            <p className="truncate text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <UserActions user={user} />
      </div>

      <Tabs defaultValue="overview" variant="underline" className="pb-8">
        <TabsList className="mb-6 border-b">
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          <TabsTrigger value="activity">{t("tabActivity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Calendar}
              label={t("joined")}
              value={formatDate(user.createdAt, locale)}
              detail={relative(user.createdAt)}
            />
            <StatCard
              icon={Clock}
              label={t("lastActive")}
              value={lastSeen ? relative(lastSeen) : "—"}
              detail={
                lastSeen ? formatDate(lastSeen, locale) : t("neverSignedIn")
              }
            />
            <StatCard
              icon={Mail}
              label={t("email")}
              value={
                <StatusPill tone={user.emailVerified ? "success" : "warning"}>
                  {user.emailVerified ? t("verified") : t("unverified")}
                </StatusPill>
              }
              detail={user.email}
            />
            <StatCard
              icon={isBanned ? Lock : ShieldCheck}
              label={t("accountState")}
              value={
                <StatusPill tone={isBanned ? "danger" : "success"}>
                  {isBanned ? t("suspended") : t("active")}
                </StatusPill>
              }
              detail={
                isBanned ? (user.banReason ?? t("noReason")) : t("canSignIn")
              }
            />
          </div>

          {isBanned ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/20 dark:bg-red-500/10">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-red-100 dark:bg-red-500/20">
                <Lock size={16} className="text-red-600 dark:text-red-300" />
              </span>
              <p className="text-sm leading-relaxed text-red-700 dark:text-red-200">
                {t("bannedNotice", {
                  reason: user.banReason ?? t("noReason"),
                })}{" "}
                {user.banExpires
                  ? t("banExpires", {
                      date: formatDate(user.banExpires, locale),
                    })
                  : t("banPermanent")}
              </p>
            </div>
          ) : null}

          <section className="flex flex-col gap-3">
            <SectionTitle title={t("securityTitle")} />
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow
                label={t("role")}
                detail={t("roleDetail")}
                value={<RoleBadge role={role} />}
              />
              <DetailRow
                label={t("twoFactor")}
                detail={t("twoFactorDetail")}
                value={
                  <StatusPill
                    tone={user.twoFactorEnabled ? "success" : "neutral"}
                  >
                    {user.twoFactorEnabled ? t("enabled") : t("disabled")}
                  </StatusPill>
                }
              />
            </div>
          </section>

          {role !== "admin" ? <OrganizationSection user={user} /> : null}
        </TabsContent>

        <TabsContent value="activity" className="flex flex-col gap-3">
          <SectionTitle
            title={t("sessionsTitle")}
            description={t("sessionsDescription")}
          />
          {sessions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {[...sessions]
                .sort(
                  (a, b) =>
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime()
                )
                .map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t("sessionsEmpty")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

function UserActions({ user }: { user: AdminUser }) {
  const t = useTranslations("AdminUser")
  const [dialog, setDialog] = useState<"ban" | "delete" | null>(null)
  const unban = useUnbanUser(user)
  const revokeSessions = useRevokeUserSessions(user)
  const isAdmin = getUserRole(user.role) === "admin"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon"
              aria-label={t("actions")}
              className="self-start md:self-auto"
            />
          }
        >
          <DotsHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem render={<a href={`mailto:${user.email}`} />}>
            <Mail size={16} />
            {t("contact")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={revokeSessions.isPending}
            onClick={() => revokeSessions.mutate()}
          >
            <Logout size={16} color="currentColor" />
            {t("revokeSessions")}
          </DropdownMenuItem>
          {isAdmin ? null : (
            <>
              <DropdownMenuSeparator />
              {user.banned ? (
                <DropdownMenuItem
                  disabled={unban.isPending}
                  onClick={() => unban.mutate()}
                >
                  <ArrowTurnLeft size={16} />
                  {t("unban")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setDialog("ban")}>
                  <HandRaised size={16} />
                  {t("ban")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDialog("delete")}
              >
                <Trash size={16} />
                {t("delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BanUserDialog
        user={user}
        open={dialog === "ban"}
        onOpenChange={(open) => setDialog(open ? "ban" : null)}
      />
      <DeleteUserDialog
        user={user}
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
      />
    </>
  )
}

function OrganizationSection({ user }: { user: AdminUser }) {
  const t = useTranslations("AdminUser")
  const { data: organizations, isPending } = useAdminUserOrganizations(user.id)
  const isBusiness = getUserRole(user.role) === "business"

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        title={isBusiness ? t("organizationTitle") : t("businessTitle")}
      />
      {isPending ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : organizations && organizations.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {organizations.map((organization) => (
            <div
              key={organization.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background">
                <BuildingOffice size={16} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {organization.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {isBusiness || !organization.owner ? (
                    t("userCount", { count: organization.userCount })
                  ) : (
                    <>
                      {t("ownedBy")}{" "}
                      <Link
                        href={`${routes.adminUsers}/${organization.owner.id}`}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {organization.owner.name}
                      </Link>
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {isBusiness ? t("noOrganization") : t("noBusiness")}
        </p>
      )}
    </section>
  )
}

function DetailRow({
  label,
  detail,
  value,
}: {
  label: string
  detail: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </div>
      <div className="shrink-0">{value}</div>
    </div>
  )
}

function SessionRow({ session }: { session: AdminSession }) {
  const t = useTranslations("AdminUser")
  const tSessions = useTranslations("AccountSessions")
  const locale = useLocale()
  const parsed = parseUserAgent(session.userAgent)
  const device = !parsed
    ? tSessions("unknownDevice")
    : parsed.system
      ? tSessions("browserOnSystem", {
          browser: parsed.browser ?? tSessions("unknownBrowser"),
          system: parsed.system,
        })
      : (parsed.browser ?? tSessions("unknownBrowser"))
  const expired = new Date(session.expiresAt).getTime() < Date.now()

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background">
          <ShieldCheck size={16} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            {device}
            {expired ? (
              <StatusPill tone="neutral">{t("expired")}</StatusPill>
            ) : null}
            {session.impersonatedBy ? (
              <StatusPill tone="warning">{t("impersonated")}</StatusPill>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              session.ipAddress,
              t("signedIn", {
                time: formatRelative(session.createdAt, locale) ?? t("justNow"),
              }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-right text-xs text-muted-foreground">
        {formatDate(session.updatedAt, locale)}
      </span>
    </li>
  )
}
