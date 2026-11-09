import type { Metadata } from "next"

import { TwoFactorForm } from "@/components/auth/two-factor-form"
import { REDIRECT_PARAM, safeRedirectPath } from "@/config/routes"

export const metadata: Metadata = { title: "Two-factor authentication" }

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const redirectTo = safeRedirectPath((await searchParams)[REDIRECT_PARAM])

  return <TwoFactorForm redirectTo={redirectTo} />
}
