import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthHeader } from "@/components/auth/auth-header"
import { SignInForm } from "@/components/auth/sign-in-form"
import { REDIRECT_PARAM, routes, safeRedirectPath } from "@/config/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignIn")
  return { title: t("metaTitle") }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const redirectTo = safeRedirectPath(
    (await searchParams)[REDIRECT_PARAM],
    // The home page sends each role on to its own start page.
    routes.home
  )
  const t = await getTranslations("SignIn")

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title={t("title")} description={t("description")} />
      <SignInForm redirectTo={redirectTo} />
    </div>
  )
}
