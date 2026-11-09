import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SERVER_URL: z.url(),
    /** Keep in sync with the port in NEXT_PUBLIC_SERVER_URL. */
    PORT: z.coerce.number().int().positive().default(3001),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
