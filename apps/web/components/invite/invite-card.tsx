"use client"

import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import { Separator } from "@workspace/ui/components/ui/separator"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Check, Loader2, Mail, X } from "@workspace/ui/icons"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { UserAvatar } from "@/components/user-avatar"
import { inviteRoute, routes, signInRoute } from "@/config/routes"
import {
  useAcceptInvitation,
  useRejectInvitation,
  useSignOutHere,
} from "@/hooks/queries/invitation"

export interface InvitationDetails {
  id: string
  email: string
  expiresAt: Date
  organizationName: string
  inviter: { name: string; email: string }
  inviteeHasAccount: boolean
}

/**
 * A pending invitation, for whoever opened its link. Signed in as the invitee,
 * they accept or decline here. Signed out, accepting continues to sign-in (if
 * they have an account) or to creating one, then comes back to accept.
 */
export function InviteCard({
  invitation,
  signedInEmail,
}: {
  invitation: InvitationDetails
  /** The signed-in account's email, or null when signed out. */
  signedInEmail: string | null
}) {
  const t = useTranslations("Invitation")
  const router = useRouter()
  const accept = useAcceptInvitation()
  const reject = useRejectInvitation()
  const signOut = useSignOutHere()

  const isRecipient =
    signedInEmail?.toLowerCase() === invitation.email.toLowerCase()
  const isOtherAccount = signedInEmail !== null && !isRecipient
  const isPending = accept.isPending || reject.isPending
  const daysLeft = Math.max(
    1,
    Math.ceil(
      (new Date(invitation.expiresAt).getTime() - Date.now()) / 86_400_000
    )
  )

  function onAccept() {
    if (!signedInEmail) {
      const path = inviteRoute(invitation.id)
      router.push(
        invitation.inviteeHasAccount
          ? signInRoute(path)
          : inviteRoute(invitation.id, "create-account")
      )
      return
    }

    accept.mutate(invitation.id, {
      onSuccess: () => {
        toast.success(
          t("welcome", { organization: invitation.organizationName })
        )
        router.replace(routes.dashboard)
        router.refresh()
      },
    })
  }

  function onReject() {
    // The page re-renders as declined.
    reject.mutate(invitation.id, { onSuccess: () => router.refresh() })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          {t("title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              name={invitation.organizationName}
              className="size-10 rounded-lg text-sm"
            />
            <span className="truncate font-medium">
              {invitation.organizationName}
            </span>
          </div>
          <Badge variant="outline">{t("role")}</Badge>
        </div>
        <Separator />
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={invitation.inviter.name} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm">
              {t.rich("invitedBy", {
                name: invitation.inviter.name,
                strong: (chunks) => (
                  <span className="font-semibold">{chunks}</span>
                ),
              })}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {invitation.inviter.email}
            </span>
          </div>
        </div>
      </div>

      {isOtherAccount ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="text-pretty">
            {t.rich("wrongAccount", {
              current: signedInEmail,
              invited: invitation.email,
              strong: (chunks) => (
                <span className="font-semibold">{chunks}</span>
              ),
            })}
          </p>
          <Button
            variant="outline"
            className="self-start"
            disabled={signOut.isPending}
            onClick={() =>
              signOut.mutate(undefined, { onSuccess: () => router.refresh() })
            }
          >
            {signOut.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("switchAccount")}
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          {isRecipient ? (
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={isPending}
              onClick={onReject}
            >
              {reject.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <X size={16} />
              )}
              {t("decline")}
            </Button>
          ) : null}
          <Button
            size="lg"
            className="flex-1"
            disabled={isPending}
            onClick={onAccept}
          >
            {accept.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {t("accept")}
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {t("expiresIn", { days: daysLeft })}
      </p>

      <Separator />

      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Mail size={16} className="size-4 shrink-0" />
        {t.rich("questions", {
          name: invitation.inviter.name,
          link: (chunks) => (
            <a
              href={`mailto:${invitation.inviter.email}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  )
}
