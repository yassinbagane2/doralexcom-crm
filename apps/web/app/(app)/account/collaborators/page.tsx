import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import {
  SettingsPage,
  SettingsSection,
} from "@/components/account/settings-section"
import { Collaborators } from "@/components/settings/collaborators"
import { getMemberRole, requireOrganization, requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Collaborators")
  return { title: t("metaTitle") }
}

export default async function CollaboratorsPage() {
  const { user } = await requireRole("business")
  const [role, organization] = await Promise.all([
    getMemberRole(),
    requireOrganization(),
  ])
  const t = await getTranslations("Collaborators")

  return (
    <SettingsPage wide>
      <SettingsSection title={t("title")} description={t("description")}>
        <Collaborators
          isOwner={role === "owner"}
          currentUserId={user.id}
          organizationName={organization.name}
        />
      </SettingsSection>
    </SettingsPage>
  )
}
