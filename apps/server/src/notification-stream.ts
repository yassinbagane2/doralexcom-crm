import { auth } from "@workspace/auth"
import { subscribeToNotifications } from "@workspace/notifications"
import type { Context } from "hono"
import { streamSSE } from "hono/streaming"

/** Proxies drop connections idle for a minute or so; this keeps it busy. */
const HEARTBEAT_MS = 25_000

/**
 * Server-sent events for the signed-in user (by their session cookie): a
 * `notification` event each time they get one, so the web app refreshes at
 * once. The event carries no content; the app refetches what it shows. The
 * stream ends when the browser leaves or `closing` aborts (shutdown).
 */
export async function notificationStream(c: Context, closing: AbortSignal) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ message: "Unauthorized" }, 401)

  // Tells nginx-style proxies not to hold events back in a buffer.
  c.header("X-Accel-Buffering", "no")

  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribeToNotifications(session.user.id, () => {
      // An event without data is never dispatched by EventSource.
      void stream.writeSSE({ event: "notification", data: "new" })
    })
    // A comment line: keeps the connection alive, ignored by EventSource.
    const heartbeat = setInterval(
      () => void stream.write(": heartbeat\n\n"),
      HEARTBEAT_MS
    )

    await new Promise<void>((resolve) => {
      stream.onAbort(resolve)
      if (closing.aborted) resolve()
      closing.addEventListener("abort", () => resolve(), { once: true })
    })

    clearInterval(heartbeat)
    unsubscribe()
  })
}
