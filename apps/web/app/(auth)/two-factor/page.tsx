import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { TwoFactorForm } from "@/components/auth/two-factor-form"
import { REDIRECT_PARAM, routes, safeRedirectPath } from "@/config/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TwoFactor")
  return { title: t("metaTitle") }
}

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const redirectTo = safeRedirectPath(
    (await searchParams)[REDIRECT_PARAM],
    // The home page sends each role on to its own start page.
    routes.home
  )

  return <TwoFactorForm redirectTo={redirectTo} />
}
