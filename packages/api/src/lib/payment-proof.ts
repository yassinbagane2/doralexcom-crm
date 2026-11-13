import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import {
  PAYMENT_PROOF_STATUSES,
  invoice,
  lease,
  organization,
  paymentProof,
  property,
  user,
} from "@workspace/db/schema"
import { and, eq, exists, sql, type SQL } from "drizzle-orm"
import { z } from "zod"

import {
  PAYMENT_PROOF_LIMITS,
  formatInvoiceNumber,
  isPaymentProofFileType,
} from "../invoice"
import { inBackground } from "./background"
import { ownerEmails } from "./landlord"
import { appLink } from "./links"
import { sendOrganizationEmail } from "./mailer"
import {
  assertPaymentFits,
  invoiceNotFound,
  lockInvoice,
  recordPayment,
  type PaymentValues,
  type Transaction,
} from "./payment"
import { paymentProofLocation } from "./storage"

/*
 * Proof of payments made outside the app. The customer uploads it against an
 * invoice (`submitPaymentProof`); the business confirms it, which records
 * the payment, or rejects it with a reason. The business can also attach
 * proof to a payment it records itself (`recordPaymentWithProof`). The file
 * goes to R2 before its row is written, and leaves once the row is gone.
 */

type ProofRow = typeof paymentProof.$inferSelect

/** Whose files these are: the key in R2 hangs off the customer. */
type ProofOwner = { id: string; organizationId: string; customerId: string }

/** A proof that hasn't (or hasn't yet) become a payment, as both sides see it. */
export const paymentProofSchema = z.object({
  id: z.string(),
  status: z.enum(PAYMENT_PROOF_STATUSES),
  amount: z.number(),
  paidOn: z.string(),
  note: z.string().nullable(),
  fileName: z.string(),
  mimeType: z.string(),
  rejectionReason: z.string().nullable(),
  createdAt: z.date(),
  reviewedAt: z.date().nullable(),
})

export function toPaymentProof(
  row: ProofRow
): z.output<typeof paymentProofSchema> {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    paidOn: row.paidOn,
    note: row.note,
    fileName: row.fileName,
    mimeType: row.mimeType,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  }
}

function proofNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Proof of payment not found.",
    data: { code: "PAYMENT_PROOF_NOT_FOUND" },
  })
}

const notPending = () =>
  new ORPCError("CONFLICT", {
    message: "This proof of payment was already reviewed.",
    data: { code: "PAYMENT_PROOF_NOT_PENDING" },
  })

/** Proof is a PDF or a picture, within the size limit. */
function assertProofFile(file: File) {
  if (!isPaymentProofFileType(file.type)) {
    throw new ORPCError("UNSUPPORTED_MEDIA_TYPE", {
      message: "Proof of payment must be a PDF or an image.",
      data: { code: "PAYMENT_PROOF_TYPE" },
    })
  }
  if (file.size === 0 || file.size > PAYMENT_PROOF_LIMITS.fileBytes) {
    throw new ORPCError("PAYLOAD_TOO_LARGE", {
      message: "The file is empty or too large.",
      data: { code: "PAYMENT_PROOF_SIZE" },
    })
  }
}

/**
 * Uploads the file, then runs `write` (which inserts the proof's row). If
 * that fails, the file is removed again: a row never points at nothing.
 */
async function withStoredFile<T>(
  owner: ProofOwner,
  file: File,
  write: () => Promise<T>
) {
  const { storage, key } = paymentProofLocation(owner)
  await storage.upload({
    key,
    body: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
  })
  try {
    return await write()
  } catch (error) {
    await discardProofFiles([owner])
    throw error
  }
}

const fileColumns = (file: File) => ({
  fileName: file.name.trim().slice(0, PAYMENT_PROOF_LIMITS.fileName) || "proof",
  mimeType: file.type,
  size: file.size,
})

/** Best effort, once the rows are gone. */
export async function discardProofFiles(owners: ProofOwner[]) {
  for (const owner of owners) {
    const { storage, key } = paymentProofLocation(owner)
    await storage.deleteObject(key).catch((error: unknown) => {
      console.error(`Could not delete ${storage.bucket}/${key}`, error)
    })
  }
}

/** The proofs `where` selects, as `discardProofFiles` takes them. */
export function proofOwners(executor: Transaction | typeof db, where: SQL) {
  return executor
    .select({
      id: paymentProof.id,
      organizationId: paymentProof.organizationId,
      customerId: lease.customerId,
    })
    .from(paymentProof)
    .innerJoin(invoice, eq(invoice.id, paymentProof.invoiceId))
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .where(where)
}

/** One pending proof per invoice: the business reviews one at a time. */
async function assertNonePending(tx: Transaction, invoiceId: string) {
  const [pending] = await tx
    .select({ id: paymentProof.id })
    .from(paymentProof)
    .where(
      and(
        eq(paymentProof.invoiceId, invoiceId),
        eq(paymentProof.status, "pending")
      )
    )
    .limit(1)
  if (pending) {
    throw new ORPCError("CONFLICT", {
      message:
        "Proof of payment for this invoice is already waiting for your landlord.",
      data: { code: "PAYMENT_PROOF_PENDING" },
    })
  }
}

// --- The customer ------------------------------------------------------------

/** The customer sends proof they paid (some of) one of their invoices. */
export async function submitPaymentProof(
  customerId: string,
  input: PaymentValues & { invoiceId: string; file: File }
) {
  assertProofFile(input.file)
  const scope = and(
    eq(invoice.id, input.invoiceId),
    eq(lease.customerId, customerId)
  )
  const [target] = await db
    .select({ organizationId: invoice.organizationId })
    .from(invoice)
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .where(scope)
  if (!target) throw invoiceNotFound()

  const owner = {
    id: crypto.randomUUID(),
    organizationId: target.organizationId,
    customerId,
  }
  await withStoredFile(owner, input.file, () =>
    db.transaction(async (tx) => {
      const locked = await lockInvoice(tx, scope)
      assertPaymentFits(locked, input.amount)
      await assertNonePending(tx, locked.id)
      await tx.insert(paymentProof).values({
        id: owner.id,
        organizationId: locked.organizationId,
        invoiceId: locked.id,
        amount: input.amount,
        paidOn: input.paidOn,
        note: input.note,
        ...fileColumns(input.file),
        submittedById: customerId,
      })
    })
  )

  inBackground(
    notifyProofSubmitted(owner.id),
    `email proof of payment ${owner.id}`
  )
  return { id: owner.id }
}

/** Takes back a proof the business hasn't reviewed yet. */
export async function cancelPaymentProof(customerId: string, id: string) {
  const [removed] = await db
    .delete(paymentProof)
    .where(
      and(
        eq(paymentProof.id, id),
        eq(paymentProof.status, "pending"),
        exists(
          db
            .select({ one: sql`1` })
            .from(invoice)
            .innerJoin(lease, eq(lease.id, invoice.leaseId))
            .where(
              and(
                eq(invoice.id, paymentProof.invoiceId),
                eq(lease.customerId, customerId)
              )
            )
        )
      )
    )
    .returning({
      id: paymentProof.id,
      organizationId: paymentProof.organizationId,
    })
  if (!removed) throw proofNotFound()
  await discardProofFiles([{ ...removed, customerId }])
}

// --- The business ------------------------------------------------------------

type Reviewer = { organizationId: string; userId: string }

/**
 * The business accepts the customer's proof: the payment it describes is
 * recorded, if it still fits what's left to pay on the invoice.
 */
export async function confirmPaymentProof(reviewer: Reviewer, id: string) {
  await db.transaction(async (tx) => {
    const proof = await findProof(tx, reviewer.organizationId, id)
    // The invoice first, then the proof: the order every payment locks in.
    const locked = await lockInvoice(tx, eq(invoice.id, proof.invoiceId))
    const [current] = await tx
      .select({ status: paymentProof.status })
      .from(paymentProof)
      .where(eq(paymentProof.id, id))
      .for("update")
    if (current?.status !== "pending") throw notPending()

    const paymentId = await recordPayment(tx, locked, proof)
    await tx
      .update(paymentProof)
      .set({
        status: "confirmed",
        paymentId,
        reviewedById: reviewer.userId,
        reviewedAt: new Date(),
      })
      .where(eq(paymentProof.id, id))
  })
  inBackground(notifyProofReviewed(id), `email proof review ${id}`)
}

/** The business turns the proof down, telling the customer why. */
export async function rejectPaymentProof(
  reviewer: Reviewer,
  id: string,
  reason: string
) {
  const [rejected] = await db
    .update(paymentProof)
    .set({
      status: "rejected",
      rejectionReason: reason,
      reviewedById: reviewer.userId,
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(paymentProof.id, id),
        eq(paymentProof.organizationId, reviewer.organizationId),
        eq(paymentProof.status, "pending")
      )
    )
    .returning({ id: paymentProof.id })
  if (!rejected) {
    await findProof(db, reviewer.organizationId, id)
    throw notPending()
  }
  inBackground(notifyProofReviewed(id), `email proof review ${id}`)
}

/**
 * The business records a payment it received, with a proof file attached
 * when it has one: confirmed from the start, since the business made it.
 */
export async function recordPaymentWithProof(
  recorder: Reviewer,
  input: PaymentValues & { invoiceId: string; file?: File }
) {
  const scope = and(
    eq(invoice.id, input.invoiceId),
    eq(invoice.organizationId, recorder.organizationId)
  )
  const { file, invoiceId: _, ...values } = input
  if (!file) {
    return db.transaction(async (tx) =>
      recordPayment(tx, await lockInvoice(tx, scope), values)
    )
  }

  assertProofFile(file)
  const [target] = await db
    .select({ customerId: lease.customerId })
    .from(invoice)
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .where(scope)
  if (!target) throw invoiceNotFound()

  const owner = {
    id: crypto.randomUUID(),
    organizationId: recorder.organizationId,
    customerId: target.customerId,
  }
  return withStoredFile(owner, file, () =>
    db.transaction(async (tx) => {
      const locked = await lockInvoice(tx, scope)
      const paymentId = await recordPayment(tx, locked, values)
      await tx.insert(paymentProof).values({
        id: owner.id,
        organizationId: locked.organizationId,
        invoiceId: locked.id,
        paymentId,
        status: "confirmed",
        ...values,
        ...fileColumns(file),
        submittedById: recorder.userId,
        reviewedById: recorder.userId,
        reviewedAt: new Date(),
      })
      return paymentId
    })
  )
}

async function findProof(
  executor: Transaction | typeof db,
  organizationId: string,
  id: string
) {
  const [found] = await executor
    .select()
    .from(paymentProof)
    .where(
      and(
        eq(paymentProof.id, id),
        eq(paymentProof.organizationId, organizationId)
      )
    )
  if (!found) throw proofNotFound()
  return found
}

// --- Either side ---------------------------------------------------------------

/** The proof's file, as long as `scope` (on its `lease`) lets the reader see it. */
export async function readProofFile(id: string, scope: SQL) {
  const [found] = await db
    .select({
      id: paymentProof.id,
      organizationId: paymentProof.organizationId,
      customerId: lease.customerId,
      fileName: paymentProof.fileName,
      mimeType: paymentProof.mimeType,
    })
    .from(paymentProof)
    .innerJoin(invoice, eq(invoice.id, paymentProof.invoiceId))
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .where(and(eq(paymentProof.id, id), scope))
  if (!found) throw proofNotFound()

  const { storage, key } = paymentProofLocation(found)
  const bytes = await storage.getObjectBytes(key)
  if (!bytes) throw proofNotFound()
  return new File([new Uint8Array(bytes)], found.fileName, {
    type: found.mimeType,
  })
}

// --- Emails --------------------------------------------------------------------

async function loadForEmail(id: string) {
  const [found] = await db
    .select({
      proof: paymentProof,
      invoiceNumber: invoice.number,
      currency: invoice.currency,
      customer: { id: user.id, name: user.name, email: user.email },
      property: property.name,
      business: organization.name,
    })
    .from(paymentProof)
    .innerJoin(invoice, eq(invoice.id, paymentProof.invoiceId))
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .innerJoin(user, eq(user.id, lease.customerId))
    .innerJoin(property, eq(property.id, lease.propertyId))
    .innerJoin(organization, eq(organization.id, paymentProof.organizationId))
    .where(eq(paymentProof.id, id))
  if (!found) return null
  return {
    ...found,
    number: formatInvoiceNumber(found.invoiceNumber),
    money: new Intl.NumberFormat("en", {
      style: "currency",
      currency: found.currency,
    }).format(found.proof.amount),
  }
}

/** Tells the business's owners there is proof of payment to review. */
async function notifyProofSubmitted(id: string) {
  const found = await loadForEmail(id)
  if (!found) return
  const { proof, customer } = found
  const link = await appLink(proof.organizationId, `/customers/${customer.id}`)
  for (const to of await ownerEmails(proof.organizationId)) {
    await sendOrganizationEmail(proof.organizationId, {
      to,
      subject: `${customer.name} sent proof of payment for invoice ${found.number}`,
      text: [
        `${customer.name} says they paid ${found.money} on ${proof.paidOn} for invoice ${found.number} (${found.property}), and sent proof.`,
        `Review it and confirm or reject the payment:\n${link}`,
      ].join("\n\n"),
    })
  }
}

/** Tells the customer what the business decided about their proof. */
async function notifyProofReviewed(id: string) {
  const found = await loadForEmail(id)
  if (!found) return
  const { proof, customer } = found
  const confirmed = proof.status === "confirmed"
  const link = await appLink(
    proof.organizationId,
    confirmed && proof.paymentId
      ? `/my-home/receipts/${proof.paymentId}`
      : "/my-home"
  )
  await sendOrganizationEmail(proof.organizationId, {
    to: customer.email,
    subject: confirmed
      ? `${found.business} confirmed your payment for invoice ${found.number}`
      : `${found.business} couldn't confirm your payment for invoice ${found.number}`,
    text: (confirmed
      ? [
          `Hi ${customer.name},`,
          `${found.business} confirmed your payment of ${found.money} for invoice ${found.number}.`,
          `Your receipt:\n${link}`,
        ]
      : [
          `Hi ${customer.name},`,
          `${found.business} couldn't confirm the payment of ${found.money} you sent proof of for invoice ${found.number}.`,
          `Their reason: ${proof.rejectionReason}`,
          `You can send new proof from your invoices:\n${link}`,
        ]
    ).join("\n\n"),
  })
}
