import { getUserRole } from "@workspace/auth/roles"
import { buttonVariants } from "@workspace/ui/components/ui/button"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { redirect } from "next/navigation"

import { HeaderControls } from "@/components/shared/header-controls"
import { homeRouteFor, routes } from "@/config/routes"
import { getSession } from "@/lib/auth"

export default async function Page() {
  const session = await getSession()

  // Signed in: straight to where this kind of account works.
  if (session) {
    redirect(homeRouteFor(getUserRole(session.user.role)))
  }

  const t = await getTranslations("Home")

  return (
    <main className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">{t("title")}</h1>
          <p>{t.rich("body", { code: (chunks) => <code>{chunks}</code> })}</p>
          <div className="mt-2 flex gap-2">
            <Link href={routes.signIn} className={buttonVariants()}>
              {t("signIn")}
            </Link>
          </div>
        </div>
      </div>
      <div className="ml-auto self-start">
        <HeaderControls />
      </div>
    </main>
  )
}
