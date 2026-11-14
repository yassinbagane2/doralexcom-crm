import { defineConfig } from "vitest/config"

import { testDatabaseUrl } from "./packages/db/test/database.ts"

// The packages read their settings from the environment, as in development.
try {
  process.loadEnvFile(".env")
} catch {
  // No .env (e.g. in CI): the environment provides them.
}

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    globalSetup: ["./packages/db/test/database.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      // Never email anyone from a test.
      RESEND_API_KEY: "",
    },
    // The test files share one database.
    fileParallelism: false,
  },
})
