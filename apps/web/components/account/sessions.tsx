"use client"

import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"

import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from "@/hooks/queries/session"
import { formatRelative } from "@/lib/format"
import { describeUserAgent } from "@/lib/user-agent"

export function Sessions({ currentSessionId }: { currentSessionId: string }) {
  const { data: sessions, isPending } = useSessions()
  const revokeSession = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()

  if (isPending) {
    return <div className="h-14 animate-pulse rounded-lg bg-muted" />
  }

  // Current device first, then most recently active.
  const sorted = [...(sessions ?? [])].sort((a, b) => {
    if (a.id === currentSessionId) return -1
    if (b.id === currentSessionId) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  const hasOthers = sorted.some((session) => session.id !== currentSessionId)

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y rounded-lg border">
        {sorted.map((session) => {
          const isCurrent = session.id === currentSessionId

          return (
            <li key={session.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {describeUserAgent(session.userAgent)}
                  {isCurrent ? (
                    <Badge variant="secondary">This device</Badge>
                  ) : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[
                    session.ipAddress,
                    `Active ${formatRelative(session.updatedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {isCurrent ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokeSession.isPending}
                  onClick={() => revokeSession.mutate(session.token)}
                >
                  Sign out
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {hasOthers ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={revokeOthers.isPending}
          onClick={() => revokeOthers.mutate()}
        >
          Sign out of all other devices
        </Button>
      ) : null}
    </div>
  )
}
