import { getUserRole } from "@workspace/auth/roles"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { getMemberRole, requireOrganization, requireSession } from "@/lib/auth"

/** Shell for every signed-in page. Its links live in components/dashboard/navigation.ts. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireSession()
  const role = getUserRole(user.role)
  // Admins run the platform from outside any organization. Everyone else
  // works inside one; a business without one yet goes to onboarding.
  const organization = role === "admin" ? null : await requireOrganization()
  const isOwner = role === "business" && (await getMemberRole()) === "owner"

  return (
    <DashboardLayout
      role={role}
      isOwner={isOwner}
      name={user.name}
      email={user.email}
      organizationName={organization?.name}
    >
      {children}
    </DashboardLayout>
  )
}
