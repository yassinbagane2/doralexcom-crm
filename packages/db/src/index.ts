import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "./env"
import * as schema from "./schema"

/*
 * Dev servers re-evaluate this module on every hot reload. Without stashing the
 * pool on globalThis, each reload opens a fresh pool and the old connections
 * linger until Postgres runs out of slots.
 */
const globalForDb = globalThis as typeof globalThis & { __dbPool__?: Pool }

function createPool() {
  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
  })
}

const pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (globalForDb.__dbPool__ ??= createPool())

export const db = drizzle({ client: pool, schema })

export type Database = typeof db

export { schema }
