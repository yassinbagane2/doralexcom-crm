"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { AssignableRole, UserRole } from "@workspace/auth/roles"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"

import { authClient, unwrap, type User } from "@/lib/auth-client"
import {
  BAN_DURATIONS,
  BAN_REASON_TEXT,
  type BanDuration,
  type BanReason,
} from "@/lib/ban"
import { orpc } from "@/lib/orpc"

/*
 * The admin dashboard. Account management goes straight to Better Auth's
 * admin plugin (admins hold every permission there); aggregate numbers come
 * from the API server's admin router.
 */

export type AdminUser = User
export type AdminSession = Awaited<ReturnType<typeof fetchUserSessions>>[number]

/** "all" means customers: admin accounts only show under their own filter. */
export type RoleFilter = "all" | UserRole

const PAGE_SIZE = 50

const keys = {
  all: ["admin-users"] as const,
  list: (params: object) => ["admin-users", "list", params] as const,
  user: (id: string) => ["admin-users", "user", id] as const,
  sessions: (id: string) => ["admin-users", "sessions", id] as const,
}

export function useAdminUsers({
  search,
  role,
  sort,
}: {
  search: string
  role: RoleFilter
  sort: "asc" | "desc"
}) {
  return useQuery({
    queryKey: keys.list({ search, role, sort }),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await unwrap(
        authClient.admin.listUsers({
          query: {
            limit: PAGE_SIZE,
            sortBy: "createdAt",
            sortDirection: sort,
            ...(search
              ? {
                  searchValue: search,
                  searchField: search.includes("@") ? "email" : "name",
                  searchOperator: "contains",
                }
              : {}),
            ...(role === "all"
              ? {
                  filterField: "role",
                  filterOperator: "ne",
                  filterValue: "admin",
                }
              : {
                  filterField: "role",
                  filterOperator: "eq",
                  filterValue: role,
                }),
          },
        })
      )

      return { users: data.users as AdminUser[], total: data.total }
    },
  })
}

export function useAdminUser(id: string, initialData: AdminUser) {
  return useQuery({
    queryKey: keys.user(id),
    initialData,
    queryFn: async () =>
      (await unwrap(authClient.admin.getUser({ query: { id } }))) as AdminUser,
  })
}

async function fetchUserSessions(userId: string) {
  const { sessions } = await unwrap(
    authClient.admin.listUserSessions({ userId })
  )
  return sessions
}

export function useAdminUserSessions(
  userId: string,
  initialData: AdminSession[]
) {
  return useQuery({
    queryKey: keys.sessions(userId),
    initialData,
    queryFn: () => fetchUserSessions(userId),
  })
}

export function useAdminUserOrganizations(userId: string) {
  return useQuery(orpc.admin.organizations.queryOptions({ input: { userId } }))
}

/** Admins create businesses; businesses then create their own users. */
export function useCreateBusiness() {
  const t = useTranslations("AdminUsers")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      name: string
      email: string
      password: string
    }) => {
      const { user } = await unwrap(
        authClient.admin.createUser({ ...input, role: "business" })
      )
      return user
    },
    onSuccess: async (user) => {
      await invalidateAccounts(queryClient)
      toast.success(t("created", { email: user.email }))
    },
  })
}

export function useBanUser(user: AdminUser) {
  const t = useTranslations("AdminBan")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      reason,
      duration,
    }: {
      reason: BanReason
      duration: BanDuration
    }) => {
      const banExpiresIn = BAN_DURATIONS[duration]
      return unwrap(
        authClient.admin.banUser({
          userId: user.id,
          banReason: BAN_REASON_TEXT[reason],
          ...(banExpiresIn ? { banExpiresIn } : {}),
        })
      )
    },
    onSuccess: async () => {
      await invalidateAccounts(queryClient)
      toast.success(t("banned", { email: user.email }))
    },
  })
}

export function useSetUserRole(user: AdminUser) {
  const t = useTranslations("AdminRole")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (role: AssignableRole) =>
      unwrap(authClient.admin.setRole({ userId: user.id, role })),
    onSuccess: async (_, role) => {
      await invalidateAccounts(queryClient)
      // A business's organization link changes meaning with the role.
      await queryClient.invalidateQueries({
        queryKey: orpc.admin.organizations.key(),
      })
      toast.success(
        t("changed", { email: user.email, role: t(`roles.${role}`) })
      )
    },
  })
}

export function useUnbanUser(user: AdminUser) {
  const t = useTranslations("AdminBan")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => unwrap(authClient.admin.unbanUser({ userId: user.id })),
    onSuccess: async () => {
      await invalidateAccounts(queryClient)
      toast.success(t("unbanned", { email: user.email }))
    },
  })
}

export function useRevokeUserSessions(user: AdminUser) {
  const t = useTranslations("AdminUser")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      unwrap(authClient.admin.revokeUserSessions({ userId: user.id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.sessions(user.id) })
      toast.success(t("sessionsRevoked"))
    },
  })
}

export function useRemoveUser(user: AdminUser) {
  const t = useTranslations("AdminUser")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => unwrap(authClient.admin.removeUser({ userId: user.id })),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: keys.user(user.id) })
      await invalidateAccounts(queryClient)
      toast.success(t("deleted", { email: user.email }))
    },
  })
}

function invalidateAccounts(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.all }),
    queryClient.invalidateQueries({ queryKey: orpc.admin.key() }),
  ])
}
