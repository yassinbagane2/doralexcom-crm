import { Button } from "@workspace/ui/components/ui/button"
import { Check, Clock, Info, X } from "@workspace/ui/icons"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { routes } from "@/config/routes"

export type InvitationNoticeKind =
  | "invalid"
  | "expired"
  | "rejected"
  | "canceled"
  | "accepted"

const ICONS = {
  invalid: Info,
  expired: Clock,
  rejected: X,
  canceled: X,
  accepted: Check,
} as const

/** An invitation that can't be answered any more, and what to do instead. */
export async function InvitationNotice({
  kind,
  inviterName,
  organizationName,
  signedIn,
}: {
  kind: InvitationNoticeKind
  inviterName?: string
  organizationName?: string
  signedIn: boolean
}) {
  const t = await getTranslations("Invitation")
  const Icon = ICONS[kind]
  const values = {
    inviter: inviterName ?? "",
    organization: organizationName ?? "",
  }

  return (
    <div className="flex flex-col gap-6">
      <span className="grid size-11 place-items-center rounded-xl border bg-muted/60 text-muted-foreground [&_svg]:size-5">
        <Icon size={20} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          {t(`notice.${kind}.title`, values)}
        </h1>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          {t(`notice.${kind}.description`, values)}
        </p>
      </div>
      <Button
        size="lg"
        render={<Link href={signedIn ? routes.home : routes.signIn} />}
      >
        {signedIn ? t("continue") : t("signIn")}
      </Button>
    </div>
  )
}
