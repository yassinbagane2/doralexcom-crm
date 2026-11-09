import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ForgotPassword")
  return { title: t("metaTitle") }
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
