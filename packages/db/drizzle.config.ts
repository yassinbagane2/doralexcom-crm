import { defineConfig } from "drizzle-kit"

import { env } from "./src/env"

export default defineConfig({
  schema: "./src/schema",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  },
})
