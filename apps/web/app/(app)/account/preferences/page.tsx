import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SettingsSection } from "@/components/account/settings-section"
import { LanguageSelect } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Preferences")
  return { title: t("metaTitle") }
}

export default async function PreferencesPage() {
  const t = await getTranslations()

  return (
    <>
      <SettingsSection
        title={t("Preferences.appearanceTitle")}
        description={t("Preferences.appearanceDescription")}
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("Theme.label")}</span>
            <span className="text-xs text-muted-foreground">
              {t("Theme.description")}
            </span>
          </div>
          <ThemeToggle className="border bg-background text-foreground" />
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("Preferences.languageTitle")}
        description={t("Preferences.languageDescription")}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="language" className="text-sm font-medium">
            {t("Language.label")}
          </label>
          <LanguageSelect id="language" />
          <p className="text-xs text-muted-foreground">
            {t("Language.description")}
          </p>
        </div>
      </SettingsSection>
    </>
  )
}
