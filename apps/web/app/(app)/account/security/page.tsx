import type { Metadata } from "next"

import { ChangePasswordForm } from "@/components/account/change-password-form"
import { Passkeys } from "@/components/account/passkeys"
import { Sessions } from "@/components/account/sessions"
import { SettingsSection } from "@/components/account/settings-section"
import { TwoFactorSettings } from "@/components/account/two-factor-settings"
import { requireSession } from "@/lib/auth"

export const metadata: Metadata = { title: "Security" }

export default async function SecurityPage() {
  const { user, session } = await requireSession()

  return (
    <>
      <SettingsSection
        title="Password"
        description="Changing it signs you out everywhere else."
      >
        <ChangePasswordForm />
      </SettingsSection>

      <SettingsSection
        title="Two-factor authentication"
        description="Ask for a code from your authenticator app after your password."
      >
        <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} />
      </SettingsSection>

      <SettingsSection
        title="Passkeys"
        description="Sign in without a password, using your device's fingerprint, face or PIN."
      >
        <Passkeys />
      </SettingsSection>

      <SettingsSection
        title="Sessions"
        description="Devices signed in to your account. Sign out any you don't recognise."
      >
        <Sessions currentSessionId={session.id} />
      </SettingsSection>
    </>
  )
}
