import { MasterDetail } from "@/components/admin/dashboard"
import { UserList } from "@/components/admin/user-list"

export default function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MasterDetail list={<UserList />}>{children}</MasterDetail>
}
