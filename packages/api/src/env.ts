import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    /** Also keys the encryption of secrets businesses store (email passwords). */
    BETTER_AUTH_SECRET: z.string().min(32),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SERVER_URL: z.url(),
    /**
     * The hostname businesses point their own domain at (a CNAME), served by
     * the TLS proxy in deploy/Caddyfile. Defaults to the web app's hostname.
     */
    CUSTOM_DOMAIN_TARGET: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

/** Where a business's custom domain must point. */
export const customDomainTarget =
  env.CUSTOM_DOMAIN_TARGET?.toLowerCase() ??
  new URL(env.NEXT_PUBLIC_APP_URL).hostname
