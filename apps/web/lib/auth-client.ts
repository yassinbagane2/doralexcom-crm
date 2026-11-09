import { passkeyClient } from "@better-auth/passkey/client"
import { organizationAdditionalFields } from "@workspace/auth/organization"
import {
  emailOTPClient,
  inferOrgAdditionalFields,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { env } from "@/env"

/** Talks to Better Auth on the API server, carrying the session cookie. */
export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [
    emailOTPClient(),
    twoFactorClient(),
    passkeyClient(),
    organizationClient({
      schema: inferOrgAdditionalFields({
        organization: { additionalFields: organizationAdditionalFields },
      }),
    }),
  ],
})

export type Session = typeof authClient.$Infer.Session
export type User = Session["user"]

/** A failed Better Auth call, carrying the server's message and code. */
export class AuthError extends Error {
  readonly code: string | undefined
  readonly status: number

  constructor({
    message,
    code,
    status,
  }: {
    message?: string
    code?: string
    status: number
  }) {
    super(message || "Something went wrong. Please try again.")
    this.name = "AuthError"
    this.code = code
    this.status = status
  }
}

type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message?: string; code?: string; status: number } }

/**
 * Better Auth resolves with `{ data, error }` instead of throwing. TanStack
 * Query only sees a failure when the promise rejects, so every hook passes its
 * call through here. Its types also allow `data: null` on success; none of the
 * calls made through here return that, so it is treated as a failure too.
 */
export async function unwrap<T>(
  request: Promise<AuthResult<T>>
): Promise<NonNullable<T>> {
  const { data, error } = await request

  if (error) {
    throw new AuthError(error)
  }

  if (data === null || data === undefined) {
    throw new AuthError({
      message: "The server sent an empty response.",
      status: 500,
    })
  }

  return data
}
