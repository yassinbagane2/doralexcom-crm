import { db } from "@workspace/db"
import { customDomain } from "@workspace/db/schema"
import { and, eq } from "drizzle-orm"

import { env } from "../env"

/**
 * Where links in a business's emails lead: its own domain once verified
 * (Settings → Web address), the platform's web app otherwise.
 */
export async function appOrigin(organizationId: string) {
  const domain = await db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.organizationId, organizationId),
      eq(customDomain.status, "active")
    ),
    columns: { hostname: true },
  })
  return domain ? `https://${domain.hostname}` : env.NEXT_PUBLIC_APP_URL
}

/** A page of the web app, on the business's own domain when it has one. */
export async function appLink(organizationId: string, path: string) {
  return new URL(path, await appOrigin(organizationId)).toString()
}
