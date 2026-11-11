import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { HeaderControls } from "@/components/header-controls"
import { LogoMark } from "@/components/logo"
import { SignOutButton } from "@/components/sign-out-button"
import { routes } from "@/config/routes"

/**
 * Outside the app shell on purpose: that shell sends anyone without an
 * organization here, so living inside it would loop.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations()

  return (
    <div className="flex min-h-svh flex-col p-6">
      <header className="flex items-center justify-between gap-4">
        <Link
          href={routes.home}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <LogoMark />
          {t("Common.appName")}
        </Link>
        <div className="flex items-center gap-1">
          <HeaderControls />
          <SignOutButton label={t("Onboarding.signOut")} />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
