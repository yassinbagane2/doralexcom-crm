import type { Metadata } from "next"

import { AccountOverview } from "@/components/account/account-overview"
import { DeleteAccount } from "@/components/account/delete-account"
import { ProfileForm } from "@/components/account/profile-form"
import { SettingsSection } from "@/components/account/settings-section"
import { requireSession } from "@/lib/auth"

export const metadata: Metadata = { title: "Account" }

export default async function AccountPage() {
  const { user } = await requireSession()

  return (
    <>
      <SettingsSection
        title="Overview"
        description="A summary of your account."
      >
        <AccountOverview />
      </SettingsSection>

      <SettingsSection
        title="Profile"
        description="How you appear across the app."
      >
        <ProfileForm name={user.name} email={user.email} />
      </SettingsSection>

      <SettingsSection
        title="Delete account"
        description="Permanently remove your account and everything tied to it."
      >
        <DeleteAccount />
      </SettingsSection>
    </>
  )
}
