"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { Chrome, Compass, Firefox } from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"

import {
  SettingsCard,
  SettingsCardHeader,
  SettingsCardRows,
  SettingsRow,
} from "@/components/account/settings-section"
import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from "@/hooks/queries/session"
import { formatRelative } from "@/lib/format"
import { parseUserAgent } from "@/lib/user-agent"

function BrowserIcon({ browser }: { browser: string | undefined }) {
  if (browser === "Chrome") return <Chrome />
  if (browser === "Firefox") return <Firefox />
  return <Compass />
}

export function Sessions({ currentSessionId }: { currentSessionId: string }) {
  const t = useTranslations("AccountSessions")
  const locale = useLocale()
  const { data: sessions, isPending } = useSessions()
  const revokeSession = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  function describeDevice(userAgent: string | null | undefined) {
    const parsed = parseUserAgent(userAgent)
    if (!parsed) return t("unknownDevice")

    const browser = parsed.browser ?? t("unknownBrowser")
    return parsed.system
      ? t("browserOnSystem", { browser, system: parsed.system })
      : browser
  }

  function describeActivity(updatedAt: Date | string) {
    const time = formatRelative(updatedAt, locale)
    return time ? t("lastActive", { time }) : t("lastActiveJustNow")
  }

  if (isPending) {
    return <div className="h-17 animate-pulse rounded-xl bg-muted" />
  }

  const all = sessions ?? []
  const current = all.find((session) => session.id === currentSessionId)
  // Most recently active first.
  const others = all
    .filter((session) => session.id !== currentSessionId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

  function renderRow(session: (typeof all)[number], isCurrent: boolean) {
    return (
      <SettingsRow
        className="group/session py-4"
        icon={
          <BrowserIcon browser={parseUserAgent(session.userAgent)?.browser} />
        }
        title={describeDevice(session.userAgent)}
        description={
          isCurrent ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-current" />
              {t("thisDevice")}
            </span>
          ) : (
            <span className="block truncate">
              {[session.ipAddress, describeActivity(session.updatedAt)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )
        }
      >
        {isCurrent ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/session:opacity-100"
            disabled={revokeSession.isPending}
            onClick={() => revokeSession.mutate(session.token)}
          >
            {t("signOut")}
          </Button>
        )}
      </SettingsRow>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {current ? (
        <SettingsCard>
          <div className="px-4">{renderRow(current, true)}</div>
        </SettingsCard>
      ) : null}

      {others.length > 0 ? (
        <SettingsCard>
          <SettingsCardHeader
            action={
              <Button
                variant="ghost"
                size="sm"
                disabled={revokeOthers.isPending}
                onClick={() => revokeOthers.mutate()}
              >
                {t("signOutAll")}
              </Button>
            }
          >
            <span className="font-medium text-foreground">
              {t("otherCount", { count: others.length })}
            </span>
          </SettingsCardHeader>
          <SettingsCardRows className="border-t border-border/60">
            {others.map((session) => (
              <li key={session.id}>{renderRow(session, false)}</li>
            ))}
          </SettingsCardRows>
        </SettingsCard>
      ) : null}
    </div>
  )
}
