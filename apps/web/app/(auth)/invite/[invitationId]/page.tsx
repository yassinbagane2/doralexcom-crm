import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { InvitationNotice } from "@/components/invite/invitation-notice"
import { InviteCard } from "@/components/invite/invite-card"
import { getSession } from "@/lib/auth"

import { getInvitation } from "./data"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Invitation")
  return { title: t("metaTitle") }
}

/** Where an invitation email lands. Public: the link is the credential. */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>
}) {
  const { invitationId } = await params
  const [invitation, session] = await Promise.all([
    getInvitation(invitationId),
    getSession(),
  ])
  const signedIn = Boolean(session)

  if (!invitation) {
    return <InvitationNotice kind="invalid" signedIn={signedIn} />
  }

  if (invitation.status !== "pending") {
    return (
      <InvitationNotice
        kind={invitation.status}
        inviterName={invitation.inviter.name}
        organizationName={invitation.organizationName}
        signedIn={signedIn}
      />
    )
  }

  return (
    <InviteCard
      invitation={invitation}
      signedInEmail={session?.user.email ?? null}
    />
  )
}
