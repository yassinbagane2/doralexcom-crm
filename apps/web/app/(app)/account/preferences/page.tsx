import { LanguageIcon, Moon } from "@workspace/ui/icons"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/account/settings-section"
import { LanguageSelect } from "@/components/shared/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Preferences")
  return { title: t("metaTitle") }
}

export default async function PreferencesPage() {
  const t = await getTranslations()

  return (
    <SettingsPage>
      <SettingsSection
        title={t("Preferences.appearanceTitle")}
        description={t("Preferences.appearanceDescription")}
      >
        <SettingsCard className="px-4">
          <SettingsRow
            icon={<Moon />}
            title={t("Theme.label")}
            description={t("Theme.description")}
          >
            <ThemeToggle className="border bg-background text-foreground" />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title={t("Preferences.languageTitle")}
        description={t("Preferences.languageDescription")}
      >
        <SettingsCard className="px-4">
          <SettingsRow
            className="flex-wrap"
            icon={<LanguageIcon />}
            title={t("Language.label")}
            description={t("Language.description")}
            htmlFor="language"
          >
            <LanguageSelect id="language" />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  )
}
