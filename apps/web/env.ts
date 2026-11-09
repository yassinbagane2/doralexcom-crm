import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

/*
 * Server-only variables (database, auth secret, email) are validated by the
 * packages that use them. This file covers what the browser bundle needs.
 */
export const env = createEnv({
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SERVER_URL: z.url(),
  },
  // Next only inlines NEXT_PUBLIC_* values it can see referenced literally.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  },
  emptyStringAsUndefined: true,
})
