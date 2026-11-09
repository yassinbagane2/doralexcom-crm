import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuthHeader } from "@/components/auth/auth-header"
import { SignUpForm } from "@/components/auth/sign-up-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignUp")
  return { title: t("metaTitle") }
}

export default async function SignUpPage() {
  const t = await getTranslations("SignUp")

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title={t("title")} description={t("description")} />
      <SignUpForm />
    </div>
  )
}
