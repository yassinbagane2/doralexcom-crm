import { getUserRole } from "@workspace/auth/roles"
import {
  ArrowRight,
  Briefcase,
  Fingerprint,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "@workspace/ui/icons"
import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import {
  DashboardBody,
  SectionTitle,
  StatCard,
  StatusPill,
} from "@/components/admin/dashboard"
import { RoleBadge } from "@/components/admin/role-badge"
import { UserAvatar } from "@/components/shared/user-avatar"
import { routes } from "@/config/routes"
import { formatRelative } from "@/lib/format"
import { client } from "@/lib/orpc"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminHome")
  return { title: t("metaTitle") }
}

export default async function AdminHomePage() {
  const t = await getTranslations("AdminHome")
  const locale = await getLocale()
  const data = await client.admin.overview()

  const percent = (count: number) =>
    data.total > 0 ? Math.round((count / data.total) * 100) : 0
  const active = data.total - data.banned

  const stats = [
    {
      icon: Users,
      label: t("totalAccounts"),
      value: data.total.toLocaleString(locale),
      detail:
        data.total > 0
          ? t("activeSuspended", { active, banned: data.banned })
          : t("noAccountsYet"),
    },
    {
      icon: Briefcase,
      label: t("businesses"),
      value: data.businesses.toLocaleString(locale),
      detail: t("usersAcross", { count: data.users }),
    },
    {
      icon: UserPlus,
      label: t("newThisMonth"),
      value: data.newThisMonth.toLocaleString(locale),
      detail: t("lastSevenDays", { count: data.newThisWeek }),
    },
    {
      icon: data.banned > 0 ? Lock : ShieldCheck,
      label: t("suspended"),
      value: data.banned.toLocaleString(locale),
      detail: data.banned > 0 ? t("suspendedSome") : t("suspendedNone"),
    },
  ]

  return (
    <DashboardBody title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="flex flex-col gap-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <SectionTitle
                title={t("recentTitle")}
                description={t("recentDescription")}
              />
              <Link
                href={routes.adminUsers}
                className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("viewAll")}
                <ArrowRight size={14} />
              </Link>
            </div>

            {data.recent.length > 0 ? (
              <div className="flex flex-col gap-2">
                {data.recent.map((account) => (
                  <Link
                    key={account.id}
                    href={`${routes.adminUsers}/${account.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={account.name} className="size-9" />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="truncate">{account.name}</span>
                          <RoleBadge role={getUserRole(account.role)} />
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {account.email}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill tone={account.banned ? "danger" : "success"}>
                        {account.banned
                          ? t("statusSuspended")
                          : t("statusActive")}
                      </StatusPill>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(account.createdAt, locale) ??
                          t("justNow")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {t("recentEmpty")}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle
              title={t("securityTitle")}
              description={t("securityDescription")}
            />
            <div className="flex flex-col gap-6 rounded-xl border bg-card p-5">
              <AdoptionBar
                icon={<Mail size={16} className="text-muted-foreground" />}
                label={t("emailVerified")}
                count={data.verified}
                total={data.total}
                percent={percent(data.verified)}
              />
              <AdoptionBar
                icon={
                  <Fingerprint size={16} className="text-muted-foreground" />
                }
                label={t("twoFactorEnabled")}
                count={data.twoFactor}
                total={data.total}
                percent={percent(data.twoFactor)}
              />
              <div className="flex items-center justify-between border-t border-border/70 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t("activeAccounts")}
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {active} / {data.total}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardBody>
  )
}

function AdoptionBar({
  icon,
  label,
  count,
  total,
  percent,
}: {
  icon: React.ReactNode
  label: string
  count: number
  total: number
  percent: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {count} / {total} · {percent}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
