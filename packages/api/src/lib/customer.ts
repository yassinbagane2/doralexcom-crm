import { ORPCError } from "@orpc/server"
import { auth } from "@workspace/auth"
import { db } from "@workspace/db"
import { invoice, lease, member, payment, user } from "@workspace/db/schema"
import { and, eq, exists, notExists, sql } from "drizzle-orm"
import { z } from "zod"

import {
  NOTE_VISIBILITIES,
  CUSTOMER_LIMITS,
  type NoteVisibility,
} from "../lease"
import { callAuth } from "./auth-error"

/*
 * A customer is a `user`-role account inside a business's organization: the
 * same accounts the business manages on its users page. What the business
 * records about them beyond name and email lives in `user.metadata`.
 */

const blankToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

const optionalEmail = z
  .union([z.literal(""), z.email().max(CUSTOMER_LIMITS.email)])
  .transform((value) => value.toLowerCase() || null)

/** One more person to reach about a customer. */
export const customerContactInput = z.object({
  name: z.string().trim().min(1).max(CUSTOMER_LIMITS.name),
  relation: blankToNull(CUSTOMER_LIMITS.relation),
  email: optionalEmail,
  phone: blankToNull(CUSTOMER_LIMITS.phone),
})

/** The details a business edits on a customer, kept in `user.metadata`. */
export const customerMetadataInput = z.object({
  phone: blankToNull(CUSTOMER_LIMITS.phone),
  address: blankToNull(CUSTOMER_LIMITS.address),
  contacts: z.array(customerContactInput).max(CUSTOMER_LIMITS.contacts),
})

export type CustomerDetails = z.output<typeof customerMetadataInput>

/** A note in `user.metadata.notes`; `shared` ones the customer sees too. */
export interface CustomerNote {
  id: string
  body: string
  visibility: NoteVisibility
  authorId: string | null
  authorName: string | null
  /** ISO timestamp. */
  createdAt: string
}

/** Everything in a customer's `user.metadata`. */
export type CustomerMetadata = CustomerDetails & { notes: CustomerNote[] }

const storedNote = z.object({
  id: z.string(),
  body: z.string(),
  visibility: z.enum(NOTE_VISIBILITIES).catch("private"),
  authorId: z.string().nullable().catch(null),
  authorName: z.string().nullable().catch(null),
  createdAt: z.string(),
})

const storedMetadata = z.object({
  phone: z.string().nullable().catch(null),
  address: z.string().nullable().catch(null),
  contacts: z
    .array(
      z.object({
        name: z.string(),
        relation: z.string().nullable().catch(null),
        email: z.string().nullable().catch(null),
        phone: z.string().nullable().catch(null),
      })
    )
    .catch([]),
  notes: z.array(storedNote).catch([]),
})

const EMPTY_METADATA: CustomerMetadata = {
  phone: null,
  address: null,
  contacts: [],
  notes: [],
}

/**
 * `user.metadata` as customer details and notes. Accounts made before the
 * business filled anything in (or with fields from elsewhere) read as blank,
 * never as an error.
 */
export function readCustomerMetadata(raw: unknown): CustomerMetadata {
  const parsed = storedMetadata.safeParse(raw ?? {})
  return parsed.success ? parsed.data : EMPTY_METADATA
}

/** Rows of the organization's customers: its `user`-role members. */
export const customerScope = (organizationId: string) =>
  and(eq(member.organizationId, organizationId), eq(user.role, "user"))

export function customerNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Customer not found.",
    data: { code: "CUSTOMER_NOT_FOUND" },
  })
}

/** The customer, if it belongs to this organization; otherwise NOT_FOUND. */
export async function findCustomer(organizationId: string, customerId: string) {
  const [found] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      metadata: user.metadata,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(customerScope(organizationId), eq(user.id, customerId)))
    .limit(1)

  if (!found) throw customerNotFound()
  return found
}

/**
 * A new `user` account inside the organization. The role is fixed here, never
 * taken from the caller.
 */
export async function createCustomerAccount(
  organizationId: string,
  input: { name: string; email: string; password: string },
  details: CustomerDetails | null = null
) {
  // No request headers: the trusted server is creating the account, so the
  // admin plugin's own permission check (admins only) doesn't apply.
  const { user: created } = await callAuth(() =>
    auth.api.createUser({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        role: "user",
      },
    })
  )

  try {
    await callAuth(() =>
      auth.api.addMember({
        body: { userId: created.id, organizationId, role: "member" },
      })
    )
    if (details) {
      const metadata: CustomerMetadata = { ...details, notes: [] }
      await db.update(user).set({ metadata }).where(eq(user.id, created.id))
    }
  } catch (error) {
    // An account outside any business would be stranded: undo it.
    await db.delete(user).where(eq(user.id, created.id))
    throw error
  }

  return created.id
}

/** The `user` row being updated or deleted is a member of the organization. */
const inOrganization = (organizationId: string) =>
  exists(
    db
      .select({ one: sql`1` })
      .from(member)
      .where(
        and(
          eq(member.userId, user.id),
          eq(member.organizationId, organizationId)
        )
      )
  )

/** Rent ever received from this customer, on any of their leases. */
const paymentsOf = (customerId: typeof user.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
    .innerJoin(lease, eq(lease.id, invoice.leaseId))
    .where(eq(lease.customerId, customerId))

/**
 * Deletes a customer's account, with its sessions, membership, leases and notes
 * (FK cascade). Refused once rent payments are recorded for them: the check
 * and the delete are one statement, so a payment recorded a moment ago still
 * counts.
 */
export async function deleteCustomerAccount(
  organizationId: string,
  customerId: string
) {
  const deleted = await db
    .delete(user)
    .where(
      and(
        eq(user.id, customerId),
        eq(user.role, "user"),
        inOrganization(organizationId),
        notExists(paymentsOf(user.id))
      )
    )
    .returning({ id: user.id })

  if (deleted.length > 0) return

  // Tells "not yours" apart from "has payments".
  await findCustomer(organizationId, customerId)
  throw new ORPCError("CONFLICT", {
    message: "Rent payments are recorded for this customer.",
    data: { code: "CUSTOMER_HAS_PAYMENTS" },
  })
}

/** The customer's own row, when it belongs to the organization. */
const ownCustomerRow = (organizationId: string, customerId: string) =>
  and(
    eq(user.id, customerId),
    eq(user.role, "user"),
    inOrganization(organizationId)
  )

/** `metadata.notes`, as an array even when missing or malformed. */
const notesArray = sql`case when jsonb_typeof(${user.metadata}->'notes') = 'array' then ${user.metadata}->'notes' else '[]'::jsonb end`

/**
 * Replaces the editable details, leaving the notes (and anything else in
 * the metadata) as they are.
 */
export async function setCustomerDetails(
  organizationId: string,
  customerId: string,
  name: string,
  details: CustomerDetails
) {
  const updated = await db
    .update(user)
    .set({
      name,
      metadata: sql`coalesce(${user.metadata}, '{}'::jsonb) || ${JSON.stringify(details)}::jsonb`,
    })
    .where(ownCustomerRow(organizationId, customerId))
    .returning({ id: user.id })

  if (updated.length === 0) throw customerNotFound()
}

/**
 * Appends a note in one statement, so two notes added at once both land
 * instead of one overwriting the other.
 */
export async function addCustomerNote(
  organizationId: string,
  customerId: string,
  note: CustomerNote
) {
  const updated = await db
    .update(user)
    .set({
      metadata: sql`jsonb_set(coalesce(${user.metadata}, '{}'::jsonb), '{notes}', ${notesArray} || ${JSON.stringify([note])}::jsonb)`,
    })
    .where(ownCustomerRow(organizationId, customerId))
    .returning({ id: user.id })

  if (updated.length === 0) throw customerNotFound()
}

/** Removes one note in one statement; NOT_FOUND when there's no such note. */
export async function removeCustomerNote(
  organizationId: string,
  customerId: string,
  noteId: string
) {
  const updated = await db
    .update(user)
    .set({
      metadata: sql`jsonb_set(${user.metadata}, '{notes}', coalesce((select jsonb_agg(n) from jsonb_array_elements(${notesArray}) as n where n->>'id' <> ${noteId}), '[]'::jsonb))`,
    })
    .where(
      and(
        ownCustomerRow(organizationId, customerId),
        sql`${notesArray} @> jsonb_build_array(jsonb_build_object('id', ${noteId}::text))`
      )
    )
    .returning({ id: user.id })

  if (updated.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: "Note not found." })
  }
}
