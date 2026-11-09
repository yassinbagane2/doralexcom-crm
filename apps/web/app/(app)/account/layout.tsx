import { getTranslations } from "next-intl/server"

import { VerifyEmailBanner } from "@/components/account/verify-email-banner"
import { DashboardBody } from "@/components/admin/dashboard"
import { requireSession } from "@/lib/auth"

/** The account pages. Their links are in the sidebar (see navigation.ts). */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()
  const t = await getTranslations("AccountLayout")

  return (
    <DashboardBody title={t("title")} description={t("description")}>
      <div className="flex w-full max-w-3xl flex-col gap-6">
        {user.emailVerified ? null : <VerifyEmailBanner email={user.email} />}
        <div>{children}</div>
      </div>
    </DashboardBody>
  )
}
