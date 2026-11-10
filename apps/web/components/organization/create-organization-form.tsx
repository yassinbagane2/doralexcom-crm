"use client"

import { useTranslations } from "next-intl"

import {
  EMPTY_ORGANIZATION_VALUES,
  OrganizationForm,
} from "@/components/organization/organization-form"
import { useCreateOrganization } from "@/hooks/queries/organization"

export function CreateOrganizationForm() {
  const t = useTranslations("Onboarding")
  const create = useCreateOrganization()

  return (
    <OrganizationForm
      defaultValues={EMPTY_ORGANIZATION_VALUES}
      submitLabel={t("submit")}
      isPending={create.isPending || create.isSuccess}
      onSubmit={(input) => create.mutate(input)}
    />
  )
}
