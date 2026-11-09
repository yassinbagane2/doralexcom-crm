import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { HeaderControls } from "@/components/header-controls"
import { routes } from "@/config/routes"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("Common")

  return (
    <div className="flex min-h-svh flex-col p-6">
      <header className="flex items-center justify-between gap-4">
        <Link href={routes.home} className="text-sm font-medium">
          {t("appName")}
        </Link>
        <HeaderControls />
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
