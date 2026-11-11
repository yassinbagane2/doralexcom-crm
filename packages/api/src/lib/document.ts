import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { lease, property } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

import { readContractContent } from "./storage"

/** Customer documents, as the business's and the customer's routers share them. */

export function documentNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Document not found.",
    data: { code: "DOCUMENT_NOT_FOUND" },
  })
}

/** A contract's content as stored, and the exact text it is stored as. */
export async function readContract(
  document: Parameters<typeof readContractContent>[0]
) {
  const stored = await readContractContent(document)
  if (!stored) throw documentNotFound()
  return stored
}

/** The property a document's lease is for, if it has one. */
export async function documentProperty({
  leaseId,
}: {
  leaseId: string | null
}) {
  if (!leaseId) return null
  const [found] = await db
    .select({ name: property.name, address: property.address })
    .from(lease)
    .innerJoin(property, eq(property.id, lease.propertyId))
    .where(eq(lease.id, leaseId))
  return found ?? null
}
