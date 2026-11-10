import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import {
  SettingsPage,
  SettingsSection,
} from "@/components/account/settings-section"
import { EmailSettings } from "@/components/settings/email-settings"
import { requireOwner } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EmailSettings")
  return { title: t("metaTitle") }
}

export default async function EmailSettingsPage() {
  await requireOwner()
  const t = await getTranslations("EmailSettings")

  return (
    <SettingsPage>
      <SettingsSection title={t("title")} description={t("description")}>
        <EmailSettings />
      </SettingsSection>
    </SettingsPage>
  )
}
