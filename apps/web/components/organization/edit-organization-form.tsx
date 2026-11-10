"use client"

import { useTranslations } from "next-intl"

import { OrganizationForm } from "@/components/organization/organization-form"
import { useUpdateOrganization } from "@/hooks/queries/organization"

export function EditOrganizationForm({
  organization,
}: {
  organization: {
    id: string
    name: string
    taxId?: string | null
    registrationNumber?: string | null
  }
}) {
  const t = useTranslations("Common")
  const update = useUpdateOrganization(organization.id)

  return (
    <OrganizationForm
      defaultValues={{
        name: organization.name,
        taxId: organization.taxId ?? "",
        registrationNumber: organization.registrationNumber ?? "",
      }}
      submitLabel={t("saveChanges")}
      isPending={update.isPending}
      onSubmit={(input) => update.mutate(input)}
    />
  )
}
