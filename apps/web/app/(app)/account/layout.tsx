import { VerifyEmailBanner } from "@/components/account/verify-email-banner"
import { DashboardBody } from "@/components/admin/dashboard"
import { requireSession } from "@/lib/auth"

/**
 * The settings pages. Their links are in the sidebar (see navigation.ts); each
 * page lays itself out with `SettingsPage`.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()

  return (
    <DashboardBody>
      <div className="flex w-full flex-col gap-6 pt-6 md:pt-8">
        {user.emailVerified ? null : (
          <div className="mx-auto w-full max-w-2xl">
            <VerifyEmailBanner email={user.email} />
          </div>
        )}
        {children}
      </div>
    </DashboardBody>
  )
}
