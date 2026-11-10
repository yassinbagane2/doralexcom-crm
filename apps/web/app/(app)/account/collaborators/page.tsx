import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SettingsSection } from "@/components/account/settings-section"
import { Collaborators } from "@/components/settings/collaborators"
import { getMemberRole, requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Collaborators")
  return { title: t("metaTitle") }
}

export default async function CollaboratorsPage() {
  const { user } = await requireRole("business")
  const isOwner = (await getMemberRole()) === "owner"
  const t = await getTranslations("Collaborators")

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <Collaborators isOwner={isOwner} currentUserId={user.id} />
    </SettingsSection>
  )
}
