import { env } from "./env"
import { subscriberHash, syncSubscriber, type NotifiedUser } from "./subscriber"
import type { InboxSession } from "./types"

/**
 * What the signed-in user's <Inbox> needs to connect: the public application
 * id, their subscriber id (their user id) and its HMAC hash. The hash can
 * only be made with the secret key, which is why the API server hands this
 * out rather than the web app building it.
 */
export function inboxSession(
  user: NotifiedUser,
  locale?: string
): InboxSession {
  if (!env.NOVU_SECRET_KEY || !env.NOVU_APPLICATION_IDENTIFIER) {
    return { enabled: false }
  }

  // Keeps the subscriber's name, email and language current for the email
  // steps of workflows. The inbox itself doesn't need it, so don't wait.
  void syncSubscriber(user, locale?.slice(0, 16)).catch((error) =>
    console.error(`Could not sync Novu subscriber ${user.id}`, error)
  )

  return {
    enabled: true,
    applicationIdentifier: env.NOVU_APPLICATION_IDENTIFIER,
    subscriberId: user.id,
    subscriberHash: subscriberHash(user.id),
    backendUrl: env.NOVU_API_URL,
    socketUrl: env.NOVU_SOCKET_URL,
  }
}
