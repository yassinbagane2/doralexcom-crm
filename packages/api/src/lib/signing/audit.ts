import type { db } from "@workspace/db"
import { documentEvent, documentSignature } from "@workspace/db/schema"

import type { SignerRole } from "../../contract"

/*
 * What a contract's audit trail is written from: who acted, from where, and
 * the rows a step leaves behind.
 */

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type EventType = (typeof documentEvent.$inferInsert)["type"]

export interface Actor {
  id: string
  name: string
  email: string
}

export type RequestMeta = ReturnType<typeof requestMeta>

/**
 * Who made a request: the client's address as the proxy in front of the API
 * saw it, and the browser it says it is.
 */
export function requestMeta(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return {
    ip: forwarded || headers.get("x-real-ip") || null,
    userAgent: headers.get("user-agent")?.slice(0, 500) || null,
  }
}

/** One step of the audit trail, taken by `actor` as one of the parties. */
export function auditEvent(
  documentId: string,
  type: EventType,
  role: SignerRole,
  actor: Actor,
  meta: RequestMeta,
  at = new Date()
): typeof documentEvent.$inferInsert {
  return {
    documentId,
    type,
    role,
    actorUserId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    ...meta,
    createdAt: at,
  }
}

/**
 * A party's signature on a contract, and the "signed" step it adds to the
 * audit trail: the two are always written together. `signer.name` is the
 * name signed with, which may differ from the account's.
 */
export async function insertSignature(
  tx: Transaction,
  documentId: string,
  signer: { role: SignerRole; actor: Actor; name: string; image: string },
  meta: RequestMeta,
  at = new Date()
) {
  const { role, actor, name, image } = signer
  await tx.insert(documentSignature).values({
    documentId,
    role,
    signerUserId: actor.id,
    signerName: name,
    signerEmail: actor.email,
    image,
    signedAt: at,
    ...meta,
  })
  await tx
    .insert(documentEvent)
    .values(
      auditEvent(documentId, "signed", role, { ...actor, name }, meta, at)
    )
}
