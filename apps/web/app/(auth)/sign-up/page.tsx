import type { Metadata } from "next"

import { AuthHeader } from "@/components/auth/auth-header"
import { SignUpForm } from "@/components/auth/sign-up-form"

export const metadata: Metadata = { title: "Create an account" }

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Create an account"
        description="We'll email you a code to verify your address."
      />
      <SignUpForm />
    </div>
  )
}
