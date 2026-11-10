import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SettingsSection } from "@/components/account/settings-section"
import { DomainSettings } from "@/components/settings/domain-settings"
import { requireOwner } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DomainSettings")
  return { title: t("metaTitle") }
}

export default async function DomainSettingsPage() {
  await requireOwner()
  const t = await getTranslations("DomainSettings")

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <DomainSettings />
    </SettingsSection>
  )
}
