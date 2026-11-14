import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"

/*
 * Tests run against their own database next to the development one (its name
 * plus `_test`), created and migrated before the first test, so they can
 * empty tables freely.
 */

const SUFFIX = "_test"

/** The test database's URL, from the development (or test) DATABASE_URL. */
export function testDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.")
  const url = new URL(databaseUrl)
  if (!url.pathname.endsWith(SUFFIX)) url.pathname += SUFFIX
  return url.toString()
}

/** Vitest global setup: makes sure the test database exists and is current. */
export default async function setup() {
  const target = new URL(testDatabaseUrl())
  const name = target.pathname.slice(1)

  // Creating a database takes a connection to another one.
  const maintenance = new URL(target)
  maintenance.pathname = "/postgres"
  const server = new Client({ connectionString: maintenance.toString() })
  await server.connect()
  try {
    const { rowCount } = await server.query(
      "select 1 from pg_database where datname = $1",
      [name]
    )
    if (!rowCount) await server.query(`create database "${name}"`)
  } finally {
    await server.end()
  }

  const client = new Client({ connectionString: target.toString() })
  await client.connect()
  try {
    await migrate(drizzle({ client }), {
      migrationsFolder: new URL("../migrations", import.meta.url).pathname,
    })
  } finally {
    await client.end()
  }
}
