"use client"

import { useMutation } from "@tanstack/react-query"

import { authClient, unwrap } from "@/lib/auth-client"

/*
 * Answering an invitation, through Better Auth's organization plugin.
 * Failures toast from one place, see `RequestErrorToasts`.
 */

/**
 * Joins the business, then makes it the session's active organization so the
 * cached session cookie carries it too (accepting only updates the database).
 */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { member } = await unwrap(
        authClient.organization.acceptInvitation({ invitationId })
      )
      await unwrap(
        authClient.organization.setActive({
          organizationId: member.organizationId,
        })
      )
      return member
    },
  })
}

export function useRejectInvitation() {
  return useMutation({
    mutationFn: (invitationId: string) =>
      unwrap(authClient.organization.rejectInvitation({ invitationId })),
  })
}

/**
 * Creates the invitee's account and signs them in. The server only allows it
 * for the invited email while the invitation is pending; accepting it is the
 * next step, with the session this starts.
 */
export function useSignUpForInvitation() {
  return useMutation({
    mutationFn: ({
      invitationId,
      ...body
    }: {
      invitationId: string
      name: string
      email: string
      password: string
    }) =>
      unwrap(
        authClient.signUp.email({
          ...body,
          fetchOptions: { query: { invitationId } },
        })
      ),
  })
}

/** Signs out without leaving the page, to answer as someone else. */
export function useSignOutHere() {
  return useMutation({
    mutationFn: () => unwrap(authClient.signOut()),
  })
}
