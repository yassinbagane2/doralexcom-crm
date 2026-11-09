import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AccountOverview } from "@/components/account/account-overview"
import { DeleteAccount } from "@/components/account/delete-account"
import { ProfileForm } from "@/components/account/profile-form"
import { SettingsSection } from "@/components/account/settings-section"
import { requireSession } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AccountLayout")
  return { title: t("title") }
}

export default async function AccountPage() {
  const { user } = await requireSession()
  const t = await getTranslations()

  return (
    <>
      <SettingsSection
        title={t("AccountOverview.title")}
        description={t("AccountOverview.description")}
      >
        <AccountOverview />
      </SettingsSection>

      <SettingsSection
        title={t("AccountProfile.title")}
        description={t("AccountProfile.description")}
      >
        <ProfileForm name={user.name} email={user.email} />
      </SettingsSection>

      <SettingsSection
        title={t("AccountDelete.title")}
        description={t("AccountDelete.description")}
      >
        <DeleteAccount />
      </SettingsSection>
    </>
  )
}
