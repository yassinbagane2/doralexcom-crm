import type { UserRole } from "@workspace/auth/roles"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"
import { TooltipProvider } from "@workspace/ui/components/ui/tooltip"
import { cookies } from "next/headers"

import { DashboardSidebar } from "./dashboard-sidebar"

/** Every signed-in page: a collapsible sidebar beside rounded panels. */
export async function DashboardLayout({
  role,
  isOwner,
  name,
  email,
  organizationName,
  children,
}: {
  role: UserRole
  /** Owns the business (as opposed to collaborating on it). */
  isOwner: boolean
  name: string
  email: string
  organizationName?: string
  children: React.ReactNode
}) {
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
        <DashboardSidebar
          role={role}
          isOwner={isOwner}
          name={name}
          email={email}
          organizationName={organizationName}
        />
        <SidebarInset className="min-h-0 bg-transparent md:my-2 md:mr-2 md:rounded-none! md:shadow-none!">
          <div className="flex items-center border-b p-3 md:hidden print:hidden">
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
