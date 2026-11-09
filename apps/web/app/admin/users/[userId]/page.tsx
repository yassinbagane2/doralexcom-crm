import { auth } from "@workspace/auth"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { UserDetail } from "@/components/admin/user-detail"
import type { AdminSession, AdminUser } from "@/hooks/queries/admin"

async function loadUser(userId: string) {
  try {
    return await auth.api.getUser({
      query: { id: userId },
      headers: await headers(),
    })
  } catch {
    // Better Auth answers an unknown id with an error, not null.
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>
}): Promise<Metadata> {
  const user = await loadUser((await params).userId)
  return { title: user?.name }
}

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const user = await loadUser(userId)

  if (!user) {
    notFound()
  }

  const { sessions } = await auth.api.listUserSessions({
    body: { userId },
    headers: await headers(),
  })

  return (
    <UserDetail
      // Fresh state (open dialogs, tab) per account.
      key={user.id}
      initialUser={user as unknown as AdminUser}
      initialSessions={sessions as unknown as AdminSession[]}
    />
  )
}
