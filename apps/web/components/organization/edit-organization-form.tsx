"use client"

import { formatIban, type LegalStructure } from "@workspace/auth/organization"
import { useTranslations } from "next-intl"

import { OrganizationForm } from "@/components/organization/organization-form"
import { useUpdateOrganization } from "@/hooks/queries/organization"

export interface EditableOrganization {
  id: string
  name: string
  taxId?: string | null
  registrationNumber?: string | null
  legalStructure?: LegalStructure | null
  address?: string | null
  vatNumber?: string | null
  bankName?: string | null
  iban?: string | null
}

export function EditOrganizationForm({
  organization,
}: {
  organization: EditableOrganization
}) {
  const t = useTranslations("Common")
  const update = useUpdateOrganization(organization.id)

  return (
    <OrganizationForm
      detailed
      defaultValues={{
        name: organization.name,
        taxId: organization.taxId ?? "",
        registrationNumber: organization.registrationNumber ?? "",
        legalStructure: organization.legalStructure ?? "",
        address: organization.address ?? "",
        vatNumber: organization.vatNumber ?? "",
        bankName: organization.bankName ?? "",
        iban: organization.iban ? formatIban(organization.iban) : "",
      }}
      submitLabel={t("saveChanges")}
      isPending={update.isPending}
      onSubmit={(input) => update.mutate(input)}
    />
  )
}
