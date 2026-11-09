import Link from "next/link"

import { UserMenu } from "@/components/user-menu"
import { DEFAULT_SIGNED_IN_ROUTE } from "@/config/routes"
import { requireSession } from "@/lib/auth"

/** Shell for every signed-in page. Add your app's navigation here. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href={DEFAULT_SIGNED_IN_ROUTE} className="text-sm font-medium">
            Tube
          </Link>
          <UserMenu name={user.name} email={user.email} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  )
}
