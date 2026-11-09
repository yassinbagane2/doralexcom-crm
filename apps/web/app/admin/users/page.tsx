import { auth } from "@workspace/auth"
import { Users } from "@workspace/ui/icons"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { routes } from "@/config/routes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminUsers")
  return { title: t("metaTitle") }
}

/** Opens the newest account, so the detail pane is never blank by default. */
export default async function AdminUsersPage() {
  const { users } = await auth.api.listUsers({
    query: {
      limit: 1,
      sortBy: "createdAt",
      sortDirection: "desc",
      filterField: "role",
      filterOperator: "ne",
      filterValue: "admin",
    },
    headers: await headers(),
  })

  const newest = users[0]
  if (newest) {
    redirect(`${routes.adminUsers}/${newest.id}`)
  }

  const t = await getTranslations("AdminUsers")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Users size={18} />
      </span>
      <h1 className="text-lg font-medium">{t("emptyTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
    </div>
  )
}
