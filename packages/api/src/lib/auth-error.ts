import { ORPCError } from "@orpc/server"
import { APIError } from "better-auth/api"

/**
 * Runs a Better Auth server call and turns its failure into an oRPC error that
 * keeps Better Auth's `code`, so the web app can translate it like any other.
 */
export async function callAuth<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (error instanceof APIError) {
      const body = error.body as { code?: string; message?: string } | undefined
      throw new ORPCError("BAD_REQUEST", {
        message: body?.message ?? error.message,
        data: { code: body?.code },
      })
    }

    throw error
  }
}
