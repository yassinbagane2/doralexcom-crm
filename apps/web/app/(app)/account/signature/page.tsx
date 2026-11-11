import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import {
  SettingsPage,
  SettingsSection,
} from "@/components/account/settings-section"
import { SignatureSettings } from "@/components/settings/signature-settings"
import { getMemberRole, requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignatureSettings")
  return { title: t("metaTitle") }
}

/** The business's signature: set by its owner, seen by every collaborator. */
export default async function SignatureSettingsPage() {
  const session = await requireRole("business")
  const isOwner = (await getMemberRole()) === "owner"
  const t = await getTranslations("SignatureSettings")

  return (
    <SettingsPage>
      <SettingsSection title={t("title")} description={t("description")}>
        <SignatureSettings
          isOwner={isOwner}
          defaultSignerName={session.user.name}
        />
      </SettingsSection>
    </SettingsPage>
  )
}
