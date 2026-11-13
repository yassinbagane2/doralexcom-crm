/**
 * A Novu SDK failure reduced to what's safe to log or throw on. The SDK's own
 * error objects carry the request, headers included, and so the secret key:
 * never log or rethrow them as they are.
 */
export function novuError(error: unknown, what: string) {
  if (error && typeof error === "object") {
    const { statusCode, message } = error as {
      statusCode?: unknown
      message?: unknown
    }
    const status = typeof statusCode === "number" ? ` (${statusCode})` : ""
    const detail = typeof message === "string" ? `: ${message}` : ""
    return new Error(`Novu: could not ${what}${status}${detail}`)
  }
  return new Error(`Novu: could not ${what}`)
}
