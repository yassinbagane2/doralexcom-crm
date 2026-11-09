import { AccountNav } from "@/components/account/account-nav"
import { VerifyEmailBanner } from "@/components/account/verify-email-banner"
import { requireSession } from "@/lib/auth"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and how you sign in.
        </p>
      </div>

      {user.emailVerified ? null : <VerifyEmailBanner email={user.email} />}

      <AccountNav />
      <div>{children}</div>
    </div>
  )
}
