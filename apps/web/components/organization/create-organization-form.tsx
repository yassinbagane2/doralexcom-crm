"use client"

import { useTranslations } from "next-intl"

import { OrganizationForm } from "@/components/organization/organization-form"
import { useCreateOrganization } from "@/hooks/queries/organization"

export function CreateOrganizationForm() {
  const t = useTranslations("Onboarding")
  const create = useCreateOrganization()

  return (
    <OrganizationForm
      defaultValues={{
        name: "",
        taxId: "",
        registrationNumber: "",
      }}
      submitLabel={t("submit")}
      isPending={create.isPending || create.isSuccess}
      onSubmit={(input) => create.mutate(input)}
    />
  )
}
