import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ForgotPassword")
  return { title: t("metaTitle") }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { email, invited } = await searchParams

  // A collaborator's invitation links here to choose their first password.
  return (
    <ForgotPasswordForm
      initialEmail={typeof email === "string" ? email : ""}
      invited={invited === "1"}
    />
  )
}
