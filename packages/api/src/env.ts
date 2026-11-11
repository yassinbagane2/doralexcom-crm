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
    /** R2 bucket holding files uploaded to customers (signed leases, ID scans…). */
    S3_INPUT_BUCKET: z.string().min(1),
    /** R2 bucket holding contracts generated from templates (their editor JSON). */
    S3_OUTPUT_BUCKET: z.string().min(1),
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
    CLOUDFLARE_API_TOKEN: z.string().min(1),
    CLOUDFLARE_API_TOKEN_ID: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

/** Where a business's custom domain must point. */
export const customDomainTarget =
  env.CUSTOM_DOMAIN_TARGET?.toLowerCase() ??
  new URL(env.NEXT_PUBLIC_APP_URL).hostname
