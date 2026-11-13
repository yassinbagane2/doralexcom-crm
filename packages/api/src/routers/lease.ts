import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import {
  customerDocument,
  invoice,
  lease,
  payment,
  property,
} from "@workspace/db/schema"
import {
  and,
  eq,
  isNull,
  lte,
  ne,
  notExists,
  sql,
  TransactionRollbackError,
} from "drizzle-orm"
import { z } from "zod"

import { documentContentSchema } from "../contract"
import { invoiceBalance } from "../invoice"
import { businessProcedure, o } from "../index"
import { MAX_TERM_MONTHS, termEndDate } from "../lease"
import { findCustomer } from "../lib/customer"
import {
  loadInvoices,
  notifyInvoicesIssued,
  syncLeaseInvoices,
} from "../lib/invoice"
import { holdsPropertyOn } from "../lib/lease"
import { buildMergeData, mergeDataSchema } from "../lib/merge-data"
import { discardProofFiles, proofOwners } from "../lib/payment-proof"
import { discardSignedPdf } from "../lib/signing/signed-pdf"
import { assertReadyToSend, sendForSignature } from "../lib/signing/workflow"
import { discardDocumentContent, saveContractContent } from "../lib/storage"
import { PROPERTY_LIMITS, RENT_CURRENCIES } from "../property"
import { assertContentSize, contractName } from "./contract"

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const day = z.iso.date()

const amount = z.number().finite().nonnegative().max(PROPERTY_LIMITS.rent)

/** Everything agreed on a lease but its rent. */
const agreement = z.object({
  startDate: day,
  endDate: day.nullable(),
  /** A length in months sets `endDate` itself. */
  termMonths: z.number().int().min(1).max(MAX_TERM_MONTHS).nullable(),
  /** Only a lease agreed in months can renew. */
  autoRenew: z.boolean(),
  charges: amount,
  additionalCosts: amount,
  discount: amount,
  deposit: amount,
})

const terms = agreement.extend({
  rent: amount,
  currency: z.enum(RENT_CURRENCIES),
})

type Agreement = z.output<typeof agreement>

/**
 * A lease agreed in months ends when they're up, whatever date came along;
 * any other lease can't renew, having no term to renew for.
 */
function settleTerm<T extends Agreement>(input: T): T {
  return input.termMonths
    ? { ...input, endDate: termEndDate(input.startDate, input.termMonths) }
    : { ...input, autoRenew: false }
}

/** How long the lease holds its property: a renewing one, indefinitely. */
const occupancy = (input: Agreement) => ({
  startDate: input.startDate,
  endDate: input.autoRenew ? null : input.endDate,
})

/** Who rents what: the two sides a new lease ties together. */
const parties = z.object({ customerId: z.uuid(), propertyId: z.uuid() })

const exitAfterEntry: [
  (dates: { startDate: string; endDate: string | null }) => boolean,
  { message: string; path: string[] },
] = [
  (dates) => !dates.endDate || dates.endDate >= dates.startDate,
  {
    message: "The exit date can't come before the entry date.",
    path: ["endDate"],
  },
]

const balanceSchema = z.object({
  due: z.number(),
  paid: z.number(),
  balance: z.number(),
})

function leaseNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Lease not found.",
    data: { code: "LEASE_NOT_FOUND" },
  })
}

/**
 * Locks the property for the rest of the transaction, so two leases can't be
 * squeezed into the same dates at once, then refuses dates another lease of
 * it already covers. Both ranges include their end day; null is open-ended.
 */
async function assertPropertyFree(
  tx: Transaction,
  organizationId: string,
  propertyId: string,
  dates: { startDate: string; endDate: string | null },
  exceptLeaseId?: string
) {
  const [locked] = await tx
    .select({ rent: property.rent, currency: property.currency })
    .from(property)
    .where(
      and(
        eq(property.id, propertyId),
        eq(property.organizationId, organizationId)
      )
    )
    .for("update")

  if (!locked) {
    throw new ORPCError("NOT_FOUND", {
      message: "Property not found.",
      data: { code: "PROPERTY_NOT_FOUND" },
    })
  }

  const [clash] = await tx
    .select({ startDate: lease.startDate, endDate: lease.endDate })
    .from(lease)
    .where(
      and(
        eq(lease.propertyId, propertyId),
        exceptLeaseId ? ne(lease.id, exceptLeaseId) : undefined,
        dates.endDate ? lte(lease.startDate, dates.endDate) : undefined,
        holdsPropertyOn(dates.startDate)
      )
    )
    .limit(1)

  if (clash) {
    throw new ORPCError("CONFLICT", {
      message: "Another lease already covers those dates for this property.",
      data: { code: "LEASE_OVERLAP" },
    })
  }

  return locked
}

/** A lease of this organization. */
async function findLease(organizationId: string, id: string) {
  const [found] = await db
    .select()
    .from(lease)
    .where(and(eq(lease.id, id), eq(lease.organizationId, organizationId)))
    .limit(1)

  if (!found) throw leaseNotFound()
  return found
}

function assertNotTerminated(row: { terminatedAt: Date | null }) {
  if (row.terminatedAt) {
    throw new ORPCError("CONFLICT", {
      message: "This lease has been terminated.",
      data: { code: "LEASE_TERMINATED" },
    })
  }
}

/** Payments on any invoice the lease produced. */
const paymentsOf = (leaseId: typeof lease.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
    .where(eq(invoice.leaseId, leaseId))

/**
 * Which property a customer occupies, when, and for how much: the agreement.
 * Its invoices carry what is owed and paid. A new lease takes the property's
 * rent; editing a lease can change it.
 * Scoped to `context.organizationId` like every business procedure.
 */
export const leaseRouter = o.prefix("/leases").router({
  /**
   * What the lease document for a lease not yet created would say: the
   * terms given, at the property's current rent, as `create` would save them.
   * The web app fills the chosen template with it and sends the result back
   * to `create`.
   */
  draftMergeData: businessProcedure
    .route({ method: "POST", path: "/draft-merge-data", tags: ["leases"] })
    .input(agreement.extend(parties.shape).refine(...exitAfterEntry))
    .output(mergeDataSchema)
    .handler(async ({ input: raw, context }) => {
      const input = settleTerm(raw)
      const customer = await findCustomer(
        context.organizationId,
        input.customerId
      )
      const [rented] = await db
        .select()
        .from(property)
        .where(
          and(
            eq(property.id, input.propertyId),
            eq(property.organizationId, context.organizationId)
          )
        )
        .limit(1)

      if (!rented) {
        throw new ORPCError("NOT_FOUND", {
          message: "Property not found.",
          data: { code: "PROPERTY_NOT_FOUND" },
        })
      }

      return buildMergeData(context.organizationId, {
        customer,
        property: rented,
        lease: { ...input, rent: rented.rent ?? 0, currency: rented.currency },
      })
    }),

  /**
   * Assigns a property to a customer. A lease never starts without its lease
   * document: the contract between the business and the customer, generated
   * from a template, is saved on the customer in the same transaction, then
   * signed for the business and sent to the customer to sign.
   */
  create: businessProcedure
    .route({ method: "POST", path: "/", tags: ["leases"] })
    .input(
      agreement
        .extend({
          ...parties.shape,
          contract: z.object({
            name: contractName,
            content: documentContentSchema,
          }),
        })
        .refine(...exitAfterEntry)
    )
    .output(z.object({ id: z.string(), documentId: z.string() }))
    .handler(async ({ input: raw, context }) => {
      const { contract, ...input } = settleTerm(raw)
      assertContentSize(contract.content)
      await findCustomer(context.organizationId, input.customerId)
      // Checked before anything is saved: the lease and its contract go
      // together, signature request included.
      await assertReadyToSend(context.organizationId, contract.content)

      // The contract's content goes to R2 before the lease is written, and is
      // removed again if the lease can't be.
      const document = {
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        customerId: input.customerId,
      }
      await saveContractContent(document, contract.content)

      const created = await db
        .transaction(async (tx) => {
          const rented = await assertPropertyFree(
            tx,
            context.organizationId,
            input.propertyId,
            occupancy(input)
          )
          // The lease starts at the property's rent, copied so a later change
          // to the property never rewrites what this lease has charged.
          const [row] = await tx
            .insert(lease)
            .values({
              ...input,
              rent: rented.rent ?? 0,
              currency: rented.currency,
              organizationId: context.organizationId,
            })
            .returning()

          const [saved] = await tx
            .insert(customerDocument)
            .values({
              ...document,
              leaseId: row!.id,
              kind: "contract",
              name: contract.name,
            })
            .returning()

          // Its first invoice, and any month already begun, due in a few days.
          const invoices = await syncLeaseInvoices(tx, row!)
          return { lease: row!, document: saved!, invoices }
        })
        .catch(async (error: unknown) => {
          await discardDocumentContent({ ...document, kind: "contract" })
          throw error
        })

      await notifyInvoicesIssued(created.invoices)
      await sendForSignature(
        created.document,
        context.session.user,
        context.headers
      )

      return { id: created.lease.id, documentId: document.id }
    }),

  update: businessProcedure
    .route({ method: "PUT", path: "/{id}", tags: ["leases"] })
    .input(terms.extend({ id: z.uuid() }).refine(...exitAfterEntry))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { id, ...values } = settleTerm(input)
      const current = await findLease(context.organizationId, id)
      assertNotTerminated(current)

      const issued = await db.transaction(async (tx) => {
        await assertPropertyFree(
          tx,
          context.organizationId,
          current.propertyId,
          occupancy(values),
          id
        )
        const [updated] = await tx
          .update(lease)
          .set(values)
          .where(and(eq(lease.id, id), isNull(lease.terminatedAt)))
          .returning()
        // New dates can move or cut short months not yet paid for.
        return updated ? syncLeaseInvoices(tx, updated) : []
      })
      await notifyInvoicesIssued(issued)

      return { id }
    }),

  /** Ends the lease on `endDate` for good and settles its account. */
  terminate: businessProcedure
    .route({ method: "POST", path: "/{id}/terminate", tags: ["leases"] })
    .input(z.object({ id: z.uuid(), endDate: day }))
    .output(balanceSchema)
    .handler(async ({ input, context }) => {
      const current = await findLease(context.organizationId, input.id)
      assertNotTerminated(current)

      if (input.endDate < current.startDate) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The exit date can't come before the entry date.",
          data: { code: "LEASE_END_BEFORE_START" },
        })
      }

      const terminatedAt = new Date()
      const issued = await db.transaction(async (tx) => {
        // Moving the exit later must not run into the next customer.
        await assertPropertyFree(
          tx,
          context.organizationId,
          current.propertyId,
          { startDate: current.startDate, endDate: input.endDate },
          current.id
        )
        const [updated] = await tx
          .update(lease)
          .set({ endDate: input.endDate, terminatedAt })
          .where(and(eq(lease.id, current.id), isNull(lease.terminatedAt)))
          .returning()
        // Unpaid months after the exit are voided, a cut-short last month
        // billed again for the days lived there.
        return updated ? syncLeaseInvoices(tx, updated) : []
      })
      await notifyInvoicesIssued(issued)

      return invoiceBalance(await loadInvoices([current.id]))
    }),

  /**
   * Removes a lease entered by mistake, along with its lease document: the
   * rows go together, then the document's content and signed PDF leave R2.
   */
  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["leases"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      // Rolled back, documents included, when payments keep the lease.
      const removed = await db
        .transaction(async (tx) => {
          // Proofs of payment go with the lease; their files after it.
          const proofs = await proofOwners(
            tx,
            eq(invoice.leaseId, input.id)
          )
          // Before the lease: deleting it sets its documents' leaseId to null.
          const documents = await tx
            .delete(customerDocument)
            .where(
              and(
                eq(customerDocument.leaseId, input.id),
                eq(customerDocument.organizationId, context.organizationId),
                eq(customerDocument.kind, "contract")
              )
            )
            .returning({
              id: customerDocument.id,
              organizationId: customerDocument.organizationId,
              customerId: customerDocument.customerId,
              kind: customerDocument.kind,
            })
          const deleted = await tx
            .delete(lease)
            .where(
              and(
                eq(lease.id, input.id),
                eq(lease.organizationId, context.organizationId),
                notExists(paymentsOf(lease.id))
              )
            )
            .returning({ id: lease.id })
          if (deleted.length === 0) tx.rollback()
          return { documents, proofs }
        })
        .catch((error: unknown) => {
          if (error instanceof TransactionRollbackError) return null
          throw error
        })

      if (removed) {
        for (const document of removed.documents) {
          await discardDocumentContent(document)
          await discardSignedPdf(document)
        }
        await discardProofFiles(removed.proofs)
        return { success: true }
      }

      await findLease(context.organizationId, input.id)
      throw new ORPCError("CONFLICT", {
        message: "Rent payments are recorded on this lease.",
        data: { code: "LEASE_HAS_PAYMENTS" },
      })
    }),
})
