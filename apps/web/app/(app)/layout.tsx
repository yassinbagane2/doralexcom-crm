import { getUserRole } from "@workspace/auth/roles"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { AppNav } from "@/components/app-nav"
import { HeaderControls } from "@/components/header-controls"
import { UserMenu } from "@/components/user-menu"
import { homeRouteFor, routes } from "@/config/routes"
import { requireOrganization, requireSession } from "@/lib/auth"

/** Shell for every signed-in page. Add your app's navigation here. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()
  const role = getUserRole(user.role)
  // Admins run the platform from outside any organization. Everyone else
  // works inside one; a business without one yet goes to onboarding.
  const organization = role === "admin" ? null : await requireOrganization()
  const t = await getTranslations("Common")

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Link href={homeRouteFor(role)} className="font-medium">
              {t("appName")}
            </Link>
            {organization ? (
              <>
                <span aria-hidden className="text-muted-foreground/50">
                  /
                </span>
                {role === "business" ? (
                  <Link
                    href={routes.accountOrganization}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {organization.name}
                  </Link>
                ) : (
                  <span className="truncate text-muted-foreground">
                    {organization.name}
                  </span>
                )}
              </>
            ) : null}
            <AppNav role={role} />
          </div>
          <div className="flex items-center gap-2">
            <HeaderControls />
            <UserMenu name={user.name} email={user.email} role={role} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  )
}
