import { buttonVariants } from "@workspace/ui/components/ui/button"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { HeaderControls } from "@/components/header-controls"
import { DEFAULT_SIGNED_IN_ROUTE, routes } from "@/config/routes"
import { getSession } from "@/lib/auth"

export default async function Page() {
  const session = await getSession()
  const t = await getTranslations("Home")

  return (
    <main className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">{t("title")}</h1>
          <p>{t.rich("body", { code: (chunks) => <code>{chunks}</code> })}</p>
          <div className="mt-2 flex gap-2">
            {session ? (
              <Link href={DEFAULT_SIGNED_IN_ROUTE} className={buttonVariants()}>
                {t("goToAccount")}
              </Link>
            ) : (
              <>
                <Link href={routes.signIn} className={buttonVariants()}>
                  {t("signIn")}
                </Link>
                <Link
                  href={routes.signUp}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("createAccount")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="ml-auto self-start">
        <HeaderControls />
      </div>
    </main>
  )
}
