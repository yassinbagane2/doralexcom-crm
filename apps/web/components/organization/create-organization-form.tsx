"use client"

import { useTranslations } from "next-intl"

import { OrganizationForm } from "@/components/organization/organization-form"
import { useCreateOrganization } from "@/hooks/queries/organization"

export function CreateOrganizationForm({ userName }: { userName: string }) {
  const t = useTranslations("Onboarding")
  const create = useCreateOrganization()

  return (
    <OrganizationForm
      // Most people signing up rent out their own property; their name is the
      // sensible starting point, and switching type keeps whatever they typed.
      defaultValues={{
        type: "personal",
        name: userName,
        taxId: "",
        registrationNumber: "",
      }}
      submitLabel={t("submit")}
      isPending={create.isPending || create.isSuccess}
      onSubmit={(input) => create.mutate(input)}
    />
  )
}
