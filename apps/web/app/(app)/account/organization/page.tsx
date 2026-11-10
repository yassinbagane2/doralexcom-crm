import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SettingsSection } from "@/components/account/settings-section"
import { EditOrganizationForm } from "@/components/organization/edit-organization-form"
import { requireOrganization, requireOwner } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrganizationSettings")
  return { title: t("metaTitle") }
}

export default async function OrganizationPage() {
  await requireOwner()
  const organization = await requireOrganization()
  const t = await getTranslations("OrganizationSettings")

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <EditOrganizationForm
        // Remount after a save so the form resets to what the server stored.
        key={JSON.stringify([
          organization.name,
          organization.taxId,
          organization.registrationNumber,
          organization.legalStructure,
          organization.address,
          organization.vatNumber,
          organization.bankName,
          organization.iban,
        ])}
        organization={organization}
      />
    </SettingsSection>
  )
}
