import { db } from "@workspace/db"
import {
  DOCUMENT_EVENT_TYPES,
  documentEvent,
  documentSignature,
  type customerDocument,
} from "@workspace/db/schema"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import {
  fillDocumentSignatures,
  SIGNATURE_STATUSES,
  SIGNER_ROLES,
  type AppliedSignature,
  type SignerRole,
} from "../../contract"
import { readContract } from "../document"

/*
 * Where a contract sent for signature stands, and its audit trail, as the
 * business and the customer (and the signed PDF's last page) read it.
 */

type DocumentRow = typeof customerDocument.$inferSelect

export const signingRecordSchema = z.object({
  status: z.enum(SIGNATURE_STATUSES),
  sentAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  contentHash: z.string().nullable(),
  signedFileHash: z.string().nullable(),
  signatures: z.array(
    z.object({
      role: z.enum(SIGNER_ROLES),
      name: z.string(),
      email: z.string().nullable(),
      signedAt: z.date(),
      ip: z.string().nullable(),
      userAgent: z.string().nullable(),
    })
  ),
  events: z.array(
    z.object({
      id: z.string(),
      type: z.enum(DOCUMENT_EVENT_TYPES),
      role: z.enum(SIGNER_ROLES).nullable(),
      name: z.string().nullable(),
      email: z.string().nullable(),
      ip: z.string().nullable(),
      userAgent: z.string().nullable(),
      at: z.date(),
    })
  ),
})

export type SigningRecord = z.output<typeof signingRecordSchema>

/**
 * Steps recorded together share a timestamp ("sent" and the business's
 * "signed", the customer's "signed" and "completed"): they read in the order
 * a signing goes through.
 */
const stepOrder = (type: (typeof DOCUMENT_EVENT_TYPES)[number]) =>
  DOCUMENT_EVENT_TYPES.indexOf(type)

async function loadSignaturesAndEvents(documentId: string) {
  const [signatures, events] = await Promise.all([
    db
      .select()
      .from(documentSignature)
      .where(eq(documentSignature.documentId, documentId))
      .orderBy(asc(documentSignature.signedAt)),
    db
      .select()
      .from(documentEvent)
      .where(eq(documentEvent.documentId, documentId))
      .orderBy(asc(documentEvent.createdAt)),
  ])
  events.sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      stepOrder(a.type) - stepOrder(b.type)
  )
  return { signatures, events }
}

type Loaded = Awaited<ReturnType<typeof loadSignaturesAndEvents>>

function toSigningRecord(
  row: DocumentRow,
  status: SigningRecord["status"],
  { signatures, events }: Loaded
): SigningRecord {
  return {
    status,
    sentAt: row.sentAt,
    completedAt: row.completedAt,
    contentHash: row.contentHash,
    signedFileHash: row.signedFileHash,
    signatures: signatures.map((signature) => ({
      role: signature.role,
      name: signature.signerName,
      email: signature.signerEmail,
      signedAt: signature.signedAt,
      ip: signature.ip,
      userAgent: signature.userAgent,
    })),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      role: event.role,
      name: event.actorName,
      email: event.actorEmail,
      ip: event.ip,
      userAgent: event.userAgent,
      at: event.createdAt,
    })),
  }
}

/** Each party's signature as it fills their fields. */
function appliedSignatures(
  signatures: Loaded["signatures"]
): Partial<Record<SignerRole, AppliedSignature>> {
  return Object.fromEntries(
    signatures.map((signature) => [
      signature.role,
      {
        image: signature.image,
        name: signature.signerName,
        signedAt: signature.signedAt.toISOString(),
      },
    ])
  )
}

/**
 * A contract's content with whatever signatures it has so far, and its
 * signing record: null while it hasn't been sent for signature.
 */
export async function signedContent(row: DocumentRow) {
  const { content } = await readContract(row)
  if (!row.signatureStatus) return { content, signing: null }

  const loaded = await loadSignaturesAndEvents(row.id)
  return {
    content: fillDocumentSignatures(
      content,
      appliedSignatures(loaded.signatures)
    ),
    signing: toSigningRecord(row, row.signatureStatus, loaded),
  }
}
