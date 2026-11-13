import { novu } from "./client"
import { novuError } from "./errors"

type Payload = Record<string, unknown>

/**
 * Starts a Novu workflow for one or more users (subscriber id = user id).
 * The workflow, set up in the Novu dashboard, decides the channels: an
 * in-app step is what lands in the inbox.
 *
 * Resolves once Novu has accepted the event; delivery happens on its side.
 * Without Novu configured it only logs, so callers needn't check.
 */
export async function notify(
  workflowId: string,
  to: string | string[],
  payload: Payload = {},
  options: {
    /** Deduplicates retries: Novu ignores a second trigger with the same id. */
    transactionId?: string
  } = {}
) {
  const recipients = Array.isArray(to) ? to : [to]
  if (recipients.length === 0) return

  const sdk = novu()
  if (!sdk) {
    console.log(
      `[novu] Novu not configured, skipped "${workflowId}" for`,
      recipients.join(", ")
    )
    return
  }

  try {
    await sdk.trigger({
      workflowId,
      to: recipients.map((subscriberId) => ({ subscriberId })),
      payload,
      ...(options.transactionId
        ? { transactionId: options.transactionId }
        : {}),
    })
  } catch (error) {
    // Callers log what they catch; the SDK's error would carry the key.
    throw novuError(error, `trigger "${workflowId}"`)
  }
}
