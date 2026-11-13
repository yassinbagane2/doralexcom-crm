import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    /**
     * Server-only: signs subscriber hashes and authenticates API calls.
     * Without it notifications are off: the inbox isn't shown and triggers
     * are skipped (logged instead), so local development needs no account.
     */
    NOVU_SECRET_KEY: z.string().min(1).optional(),
    /** Public id of the Novu environment the inbox connects to. */
    NOVU_APPLICATION_IDENTIFIER: z.string().min(1).optional(),
    /**
     * Novu's region. Leave unset for the US; for the EU use
     * https://eu.api.novu.co and wss://eu.socket.novu.co.
     */
    NOVU_API_URL: z.url().optional(),
    NOVU_SOCKET_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

/** Novu is configured: both its keys are set. */
export const novuEnabled = Boolean(
  env.NOVU_SECRET_KEY && env.NOVU_APPLICATION_IDENTIFIER
)
