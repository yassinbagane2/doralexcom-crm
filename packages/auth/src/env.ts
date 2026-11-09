import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    /** Where the web app runs. Trusted for CSRF, and the passkey origin. */
    NEXT_PUBLIC_APP_URL: z.url(),
    /** Where the API server runs. Better Auth is mounted here, at /api/auth. */
    NEXT_PUBLIC_SERVER_URL: z.url(),
    /**
     * Parent domain shared by the web app and the API in production, e.g.
     * `example.com` for app.example.com + api.example.com. Leave unset when both
     * run on one host (localhost included): cookies ignore ports.
     */
    AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
    /** Without a key, emails are printed to the server console instead. */
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).default("Tube <onboarding@resend.dev>"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
