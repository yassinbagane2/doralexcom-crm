import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import {
  customerDocument,
  documentEvent,
  documentSignature,
  organizationSignature,
} from "@workspace/db/schema"
import { and, desc, eq, isNull } from "drizzle-orm"

import { signatureRoles, type DocumentContent } from "../../contract"
import { documentNotFound, readContract } from "../document"
import { sha256 } from "../hash"
import { saveContractContent } from "../storage"
import { auditEvent, insertSignature, requestMeta, type Actor } from "./audit"
import { notifySignatureRequested, notifySigned } from "./notifications"
import { discardSignedPdf, tryWriteSignedPdf } from "./signed-pdf"

/*
 * Signing contracts, the way DocuSeal does it for PDFs: the business places
 * signature fields for itself and its customer in the editor, then sends the
 * contract. Sending freezes the content (its SHA-256 is kept), signs it for
 * the business with the signature set in its settings, and asks the customer
 * to sign. Once they have, the contract is complete. Each signature writes the
 * contract's PDF in R2 (see signed-pdf.ts), the customer's over the
 * business's, so the stored PDF always shows every signature so far.
 *
 *   (draft) ──send──▶ pending ──customer signs──▶ completed
 *      ▲                 │
 *      └────withdraw─────┘
 */

type DocumentRow = typeof customerDocument.$inferSelect

const documentLocked = () =>
  new ORPCError("CONFLICT", {
    message:
      "This contract was sent for signature. Withdraw it before editing.",
    data: { code: "DOCUMENT_LOCKED" },
  })

const documentNotPending = (message: string) =>
  new ORPCError("CONFLICT", {
    message,
    data: { code: "DOCUMENT_NOT_PENDING" },
  })

const NOT_WITHDRAWABLE =
  "Only a contract waiting for the customer can be withdrawn."
const NOT_SIGNABLE = "This document isn't waiting for your signature."

/** A contract sent for signature can no longer change. */
export function assertEditable(row: Pick<DocumentRow, "signatureStatus">) {
  if (row.signatureStatus) throw documentLocked()
}

/**
 * Whether a contract can be sent for signature: the business needs a
 * signature to sign it with, and the customer a field to sign in. Returns
 * the business's signature.
 */
export async function assertReadyToSend(
  organizationId: string,
  content: DocumentContent
) {
  const businessSignature = await db.query.organizationSignature.findFirst({
    where: eq(organizationSignature.organizationId, organizationId),
  })
  if (!businessSignature) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message:
        "Set up your business's signature in Settings → Signature before sending contracts for signature.",
      data: { code: "NO_BUSINESS_SIGNATURE" },
    })
  }
  const roles = signatureRoles(content.body, content.header, content.footer)
  if (!roles.has("customer")) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Add a signature field for the customer to the contract first.",
      data: { code: "NO_CUSTOMER_SIGNATURE_FIELD" },
    })
  }
  return businessSignature
}

/**
 * Sends a contract to its customer for signature, signed for the business.
 * The caller has checked that `row` is the business's own contract.
 */
export async function sendForSignature(
  row: DocumentRow,
  actor: Actor,
  headers: Headers
) {
  if (row.kind !== "contract") throw documentNotFound()
  assertEditable(row)
  const { content } = await readContract(row)
  const businessSignature = await assertReadyToSend(row.organizationId, content)

  // Stored again in canonical form, so the hash is of exactly what's kept.
  const contentHash = sha256(await saveContractContent(row, content))
  const meta = requestMeta(headers)
  const at = new Date()

  const sent = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(customerDocument)
      .set({
        signatureStatus: "pending",
        sentAt: at,
        completedAt: null,
        contentHash,
        signedFileHash: null,
      })
      .where(
        and(
          eq(customerDocument.id, row.id),
          isNull(customerDocument.signatureStatus)
        )
      )
      .returning({ id: customerDocument.id })
    if (!updated) return false

    await tx
      .delete(documentSignature)
      .where(eq(documentSignature.documentId, row.id))
    await tx
      .insert(documentEvent)
      .values(auditEvent(row.id, "sent", "landlord", actor, meta, at))
    await insertSignature(
      tx,
      row.id,
      {
        role: "landlord",
        actor,
        name: businessSignature.signerName,
        image: businessSignature.image,
      },
      meta,
      at
    )
    return true
  })
  if (!sent) throw documentLocked()

  await tryWriteSignedPdf(row)
  notifySignatureRequested(row)
}

/** Takes a contract back from its customer, unsigned, to edit it again. */
export async function withdrawSignatureRequest(
  row: DocumentRow,
  actor: Actor,
  headers: Headers
) {
  if (row.signatureStatus !== "pending") {
    throw documentNotPending(NOT_WITHDRAWABLE)
  }

  const withdrawn = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(customerDocument)
      .set({
        signatureStatus: null,
        sentAt: null,
        contentHash: null,
        signedFileHash: null,
      })
      .where(
        and(
          eq(customerDocument.id, row.id),
          eq(customerDocument.signatureStatus, "pending")
        )
      )
      .returning({ id: customerDocument.id })
    if (!updated) return false

    await tx
      .delete(documentSignature)
      .where(eq(documentSignature.documentId, row.id))
    await tx
      .insert(documentEvent)
      .values(
        auditEvent(row.id, "withdrawn", "landlord", actor, requestMeta(headers))
      )
    return true
  })
  // The customer signed in the meantime: their PDF must stay.
  if (!withdrawn) throw documentNotPending(NOT_WITHDRAWABLE)

  // The business-signed PDF no longer stands for anything.
  await discardSignedPdf(row)
}

/** The customer opened the contract: noted once per signature request. */
export async function recordViewed(
  row: DocumentRow,
  actor: Actor,
  headers: Headers
) {
  if (row.signatureStatus !== "pending") return
  const [latest] = await db
    .select({ type: documentEvent.type, role: documentEvent.role })
    .from(documentEvent)
    .where(eq(documentEvent.documentId, row.id))
    .orderBy(desc(documentEvent.createdAt))
    .limit(1)
  if (latest?.type === "viewed" && latest.role === "customer") return

  await db
    .insert(documentEvent)
    .values(
      auditEvent(row.id, "viewed", "customer", actor, requestMeta(headers))
    )
}

/**
 * The customer signs: the content must still be exactly what was sent. The
 * contract is then complete, and its PDF printed again with both signatures.
 */
export async function signAsCustomer(
  row: DocumentRow,
  actor: Actor,
  signature: { name: string; image: string },
  headers: Headers
) {
  if (row.signatureStatus !== "pending") {
    throw documentNotPending(NOT_SIGNABLE)
  }
  const { text } = await readContract(row)
  if (sha256(text) !== row.contentHash) {
    throw new ORPCError("CONFLICT", {
      message:
        "This document changed after it was sent. Ask your landlord to send it again.",
      data: { code: "DOCUMENT_TAMPERED" },
    })
  }

  const meta = requestMeta(headers)
  const completedAt = new Date()
  const signed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(customerDocument)
      .set({ signatureStatus: "completed", completedAt })
      .where(
        and(
          eq(customerDocument.id, row.id),
          eq(customerDocument.signatureStatus, "pending")
        )
      )
      .returning({ id: customerDocument.id })
    if (!updated) return false

    await insertSignature(
      tx,
      row.id,
      { role: "customer", actor, ...signature },
      meta,
      completedAt
    )
    await tx
      .insert(documentEvent)
      .values({ documentId: row.id, type: "completed", createdAt: completedAt })
    return true
  })
  if (!signed) throw documentNotPending(NOT_SIGNABLE)

  await tryWriteSignedPdf(row)
  notifySigned(row, signature.name)
}
