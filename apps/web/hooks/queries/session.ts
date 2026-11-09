"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/ui/sonner"

import { authClient, unwrap } from "@/lib/auth-client"
import { orpc } from "@/lib/orpc"

export function useSessions() {
  return useQuery({
    queryKey: ["user-sessions"],
    queryFn: () => unwrap(authClient.listSessions()),
  })
}

function useInvalidateSessions() {
  const queryClient = useQueryClient()

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] }),
      queryClient.invalidateQueries({ queryKey: orpc.user.overview.key() }),
    ])
}

export function useRevokeSession() {
  const invalidateSessions = useInvalidateSessions()

  return useMutation({
    mutationFn: (token: string) => unwrap(authClient.revokeSession({ token })),
    onSuccess: async () => {
      await invalidateSessions()
      toast.success("Session signed out")
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useRevokeOtherSessions() {
  const invalidateSessions = useInvalidateSessions()

  return useMutation({
    mutationFn: () => unwrap(authClient.revokeOtherSessions()),
    onSuccess: async () => {
      await invalidateSessions()
      toast.success("Signed out of all other devices")
    },
    onError: (error) => toast.error(error.message),
  })
}
