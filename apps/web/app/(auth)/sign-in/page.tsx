import type { Metadata } from "next"

import { AuthHeader } from "@/components/auth/auth-header"
import { SignInForm } from "@/components/auth/sign-in-form"
import { REDIRECT_PARAM, safeRedirectPath } from "@/config/routes"

export const metadata: Metadata = { title: "Sign in" }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const redirectTo = safeRedirectPath((await searchParams)[REDIRECT_PARAM])

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader title="Sign in" description="Welcome back." />
      <SignInForm redirectTo={redirectTo} />
    </div>
  )
}
