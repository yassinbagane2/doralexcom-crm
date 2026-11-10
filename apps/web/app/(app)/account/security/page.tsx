import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ChangePasswordForm } from "@/components/account/change-password-form"
import { Passkeys } from "@/components/account/passkeys"
import { Sessions } from "@/components/account/sessions"
import {
  SettingsPage,
  SettingsSection,
} from "@/components/account/settings-section"
import { TwoFactorSettings } from "@/components/account/two-factor-settings"
import { requireSession } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AccountSecurity")
  return { title: t("metaTitle") }
}

export default async function SecurityPage() {
  const { user, session } = await requireSession()
  const t = await getTranslations()

  return (
    <SettingsPage>
      <SettingsSection
        title={t("AccountSessions.title")}
        description={t("AccountSessions.description")}
      >
        <Sessions currentSessionId={session.id} />
      </SettingsSection>

      <SettingsSection
        title={t("AccountTwoFactor.title")}
        description={t("AccountTwoFactor.description")}
      >
        <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} />
      </SettingsSection>

      <SettingsSection
        title={t("AccountPasskeys.title")}
        description={t("AccountPasskeys.description")}
      >
        <Passkeys />
      </SettingsSection>

      <SettingsSection
        title={t("AccountPassword.title")}
        description={t("AccountPassword.description")}
      >
        <ChangePasswordForm />
      </SettingsSection>
    </SettingsPage>
  )
}
