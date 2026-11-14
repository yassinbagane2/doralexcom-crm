import type { UserRole } from "@workspace/auth/roles"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"
import { TooltipProvider } from "@workspace/ui/components/ui/tooltip"
import { cookies } from "next/headers"

import { CustomerDock } from "./customer-dock"
import { DashboardSidebar } from "./dashboard-sidebar"

/**
 * Every signed-in page: a collapsible sidebar beside rounded panels. Customers,
 * who have only a few pages, get a dock at the bottom instead.
 */
export async function DashboardLayout({
  role,
  isOwner,
  name,
  email,
  children,
}: {
  role: UserRole
  /** Owns the business (as opposed to collaborating on it). */
  isOwner: boolean
  name: string
  email: string
  children: React.ReactNode
}) {
  if (role === "user") {
    return (
      <TooltipProvider>
        <div className="flex min-h-svh flex-col p-2 pb-24 md:h-svh">
          {children}
        </div>
        <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 print:hidden">
          <div className="pointer-events-auto">
            <CustomerDock role={role} isOwner={isOwner} />
          </div>
        </nav>
      </TooltipProvider>
    )
  }

  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="h-svh"
        style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
      >
        <DashboardSidebar
          role={role}
          isOwner={isOwner}
          name={name}
          email={email}
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
