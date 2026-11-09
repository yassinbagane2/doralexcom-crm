/*
 * Bootstraps a platform admin. Public sign-up is off, so the first admin can
 * only come from here:
 *
 *   pnpm admin:create --email you@example.com --name "Your Name" --password '…'
 *
 * An existing account with that email is promoted instead (password ignored).
 */
import { parseArgs } from "node:util"

import { auth } from "@workspace/auth"
import { db } from "@workspace/db"
import { user } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
  },
})

const email = values.email?.trim().toLowerCase()

if (!email) {
  console.error(
    "Usage: pnpm admin:create --email <email> [--name <name>] [--password <password>]"
  )
  process.exit(1)
}

const existing = await db.query.user.findFirst({
  where: eq(user.email, email),
  columns: { id: true },
})

if (existing) {
  await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id))
  console.log(`Promoted ${email} to admin.`)
} else {
  if (!values.password) {
    console.error(
      "No account with that email yet: pass --password to create one."
    )
    process.exit(1)
  }

  // Called without request headers, so the admin plugin skips its permission
  // check: this is the trusted server, not a signed-in user.
  await auth.api.createUser({
    body: {
      email,
      name: values.name?.trim() || email,
      password: values.password,
      role: "admin",
    },
  })
  console.log(`Created admin ${email}.`)
}

process.exit(0)
