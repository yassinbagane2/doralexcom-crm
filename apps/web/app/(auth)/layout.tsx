import Link from "next/link"

import { routes } from "@/config/routes"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col p-6">
      <Link href={routes.home} className="self-start text-sm font-medium">
        Tube
      </Link>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
