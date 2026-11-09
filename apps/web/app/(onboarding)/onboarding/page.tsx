import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { AuthHeader } from "@/components/auth/auth-header"
import { CreateOrganizationForm } from "@/components/organization/create-organization-form"
import { DEFAULT_SIGNED_IN_ROUTE } from "@/config/routes"
import { getActiveOrganization, requireSession } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Onboarding")
  return { title: t("metaTitle") }
}

export default async function OnboardingPage() {
  const { user } = await requireSession()

  // One organization per account for now: nothing left to set up.
  if (await getActiveOrganization()) {
    redirect(DEFAULT_SIGNED_IN_ROUTE)
  }

  const t = await getTranslations("Onboarding")

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("step")}
        </span>
        <AuthHeader title={t("title")} description={t("description")} />
      </div>
      <CreateOrganizationForm userName={user.name} />
    </div>
  )
}
