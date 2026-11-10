import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { AuthHeader } from "@/components/auth/auth-header"
import { CreateAccountForm } from "@/components/invite/create-account-form"
import { inviteRoute, signInRoute } from "@/config/routes"
import { getSession } from "@/lib/auth"

import { getInvitation } from "../data"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Invitation")
  return { title: t("createAccountMetaTitle") }
}

/**
 * For an invitee without an account. Anyone else goes back to the invitation:
 * signed in, they answer there; with an account, they sign in first.
 */
export default async function CreateAccountPage({
  params,
}: {
  params: Promise<{ invitationId: string }>
}) {
  const { invitationId } = await params
  const [invitation, session] = await Promise.all([
    getInvitation(invitationId),
    getSession(),
  ])

  if (session || !invitation || invitation.status !== "pending") {
    redirect(inviteRoute(invitationId))
  }
  if (invitation.inviteeHasAccount) {
    redirect(signInRoute(inviteRoute(invitationId)))
  }

  const t = await getTranslations("Invitation")

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title={t("createAccountTitle")}
        description={t("createAccountDescription", {
          organization: invitation.organizationName,
        })}
      />
      <CreateAccountForm
        invitationId={invitation.id}
        email={invitation.email}
        organizationName={invitation.organizationName}
      />
    </div>
  )
}
