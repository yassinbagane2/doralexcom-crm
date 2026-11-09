import { TooltipProvider } from "@workspace/ui/components/ui/tooltip"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminNav")
  return { title: { template: `%s · ${t("badge")}`, default: t("badge") } }
}

/** The admin dashboard: a collapsible sidebar beside rounded panels. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // proxy.ts already turns non-admins away; this is the second check.
  const { user } = await requireRole("admin")
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
        <AdminSidebar name={user.name} email={user.email} />
        <SidebarInset className="min-h-0 bg-transparent md:my-2 md:mr-2 md:rounded-none! md:shadow-none!">
          <div className="flex items-center border-b p-3 md:hidden">
            <SidebarTrigger />
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2 md:p-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
