import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { DashboardBody } from "@/components/admin/dashboard"
import { InboxPage } from "@/components/inbox/inbox-page"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Inbox")
  return { title: t("metaTitle") }
}

export default async function Page() {
  const { role } = await requireRole("business", "user")

  return (
    <DashboardBody className="pt-6">
      {/* The open conversation is read from the address. */}
      <Suspense>
        <InboxPage side={role === "business" ? "business" : "customer"} />
      </Suspense>
    </DashboardBody>
  )
}
