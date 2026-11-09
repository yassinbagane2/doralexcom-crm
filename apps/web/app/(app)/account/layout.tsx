import { getTranslations } from "next-intl/server"

import { AccountNav } from "@/components/account/account-nav"
import { VerifyEmailBanner } from "@/components/account/verify-email-banner"
import { getUserRole } from "@workspace/auth/roles"

import { requireSession } from "@/lib/auth"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()
  const t = await getTranslations("AccountLayout")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {user.emailVerified ? null : <VerifyEmailBanner email={user.email} />}

      <AccountNav role={getUserRole(user.role)} />
      <div>{children}</div>
    </div>
  )
}
