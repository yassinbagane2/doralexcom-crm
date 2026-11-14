import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"

import { db } from "../src/index"
import { user } from "../src/schema"

/*
 * Helpers for tests, which run against the test database (see database.ts).
 */

/** Empties every table the app writes to. */
export async function resetDatabase() {
  await db.execute(sql`truncate table "user", organization cascade`)
}

/** A user account, with whatever fields the test cares about. */
export async function createUser(
  fields: Partial<typeof user.$inferInsert> = {}
) {
  const id = randomUUID()
  const [created] = await db
    .insert(user)
    .values({
      name: "Test User",
      email: `${id}@example.test`,
      ...fields,
    })
    .returning()
  return created!
}
