import { ORPCError } from "@orpc/server"
import { auth } from "@workspace/auth"
import { db } from "@workspace/db"
import { lease, member, payment, user } from "@workspace/db/schema"
import { and, eq, exists, notExists, sql } from "drizzle-orm"
import { z } from "zod"

import { NOTE_VISIBILITIES, TENANT_LIMITS, type NoteVisibility } from "../lease"
import { callAuth } from "./auth-error"

/*
 * A tenant is a `user`-role account inside a business's organization: the
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
  .union([z.literal(""), z.email().max(TENANT_LIMITS.email)])
  .transform((value) => value.toLowerCase() || null)

/** One more person to reach about a tenant. */
export const tenantContactInput = z.object({
  name: z.string().trim().min(1).max(TENANT_LIMITS.name),
  relation: blankToNull(TENANT_LIMITS.relation),
  email: optionalEmail,
  phone: blankToNull(TENANT_LIMITS.phone),
})

/** The details a business edits on a tenant, kept in `user.metadata`. */
export const tenantMetadataInput = z.object({
  phone: blankToNull(TENANT_LIMITS.phone),
  address: blankToNull(TENANT_LIMITS.address),
  contacts: z.array(tenantContactInput).max(TENANT_LIMITS.contacts),
})

export type TenantDetails = z.output<typeof tenantMetadataInput>

/** A note in `user.metadata.notes`; `shared` ones the tenant sees too. */
export interface TenantNote {
  id: string
  body: string
  visibility: NoteVisibility
  authorId: string | null
  authorName: string | null
  /** ISO timestamp. */
  createdAt: string
}

/** Everything in a tenant's `user.metadata`. */
export type TenantMetadata = TenantDetails & { notes: TenantNote[] }

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

const EMPTY_METADATA: TenantMetadata = {
  phone: null,
  address: null,
  contacts: [],
  notes: [],
}

/**
 * `user.metadata` as tenant details and notes. Accounts made before the
 * business filled anything in (or with fields from elsewhere) read as blank,
 * never as an error.
 */
export function readTenantMetadata(raw: unknown): TenantMetadata {
  const parsed = storedMetadata.safeParse(raw ?? {})
  return parsed.success ? parsed.data : EMPTY_METADATA
}

/** Rows of the organization's tenants: its `user`-role members. */
export const tenantScope = (organizationId: string) =>
  and(eq(member.organizationId, organizationId), eq(user.role, "user"))

export function tenantNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Tenant not found.",
    data: { code: "TENANT_NOT_FOUND" },
  })
}

/** The tenant, if it belongs to this organization; otherwise NOT_FOUND. */
export async function findTenant(organizationId: string, tenantId: string) {
  const [found] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      metadata: user.metadata,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(tenantScope(organizationId), eq(user.id, tenantId)))
    .limit(1)

  if (!found) throw tenantNotFound()
  return found
}

/**
 * A new `user` account inside the organization. The role is fixed here, never
 * taken from the caller.
 */
export async function createTenantAccount(
  organizationId: string,
  input: { name: string; email: string; password: string },
  details: TenantDetails | null = null
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
      const metadata: TenantMetadata = { ...details, notes: [] }
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

/** Rent ever received from this tenant, on any of their leases. */
const paymentsOf = (tenantId: typeof user.id) =>
  db
    .select({ one: sql`1` })
    .from(payment)
    .innerJoin(lease, eq(lease.id, payment.leaseId))
    .where(eq(lease.tenantId, tenantId))

/**
 * Deletes a tenant's account, with its sessions, membership, leases and notes
 * (FK cascade). Refused once rent payments are recorded for them: the check
 * and the delete are one statement, so a payment recorded a moment ago still
 * counts.
 */
export async function deleteTenantAccount(
  organizationId: string,
  tenantId: string
) {
  const deleted = await db
    .delete(user)
    .where(
      and(
        eq(user.id, tenantId),
        eq(user.role, "user"),
        inOrganization(organizationId),
        notExists(paymentsOf(user.id))
      )
    )
    .returning({ id: user.id })

  if (deleted.length > 0) return

  // Tells "not yours" apart from "has payments".
  await findTenant(organizationId, tenantId)
  throw new ORPCError("CONFLICT", {
    message: "Rent payments are recorded for this tenant.",
    data: { code: "TENANT_HAS_PAYMENTS" },
  })
}

/** The tenant's own row, when it belongs to the organization. */
const ownTenantRow = (organizationId: string, tenantId: string) =>
  and(
    eq(user.id, tenantId),
    eq(user.role, "user"),
    inOrganization(organizationId)
  )

/** `metadata.notes`, as an array even when missing or malformed. */
const notesArray = sql`case when jsonb_typeof(${user.metadata}->'notes') = 'array' then ${user.metadata}->'notes' else '[]'::jsonb end`

/**
 * Replaces the editable details, leaving the notes (and anything else in
 * the metadata) as they are.
 */
export async function setTenantDetails(
  organizationId: string,
  tenantId: string,
  name: string,
  details: TenantDetails
) {
  const updated = await db
    .update(user)
    .set({
      name,
      metadata: sql`coalesce(${user.metadata}, '{}'::jsonb) || ${JSON.stringify(details)}::jsonb`,
    })
    .where(ownTenantRow(organizationId, tenantId))
    .returning({ id: user.id })

  if (updated.length === 0) throw tenantNotFound()
}

/**
 * Appends a note in one statement, so two notes added at once both land
 * instead of one overwriting the other.
 */
export async function addTenantNote(
  organizationId: string,
  tenantId: string,
  note: TenantNote
) {
  const updated = await db
    .update(user)
    .set({
      metadata: sql`jsonb_set(coalesce(${user.metadata}, '{}'::jsonb), '{notes}', ${notesArray} || ${JSON.stringify([note])}::jsonb)`,
    })
    .where(ownTenantRow(organizationId, tenantId))
    .returning({ id: user.id })

  if (updated.length === 0) throw tenantNotFound()
}

/** Removes one note in one statement; NOT_FOUND when there's no such note. */
export async function removeTenantNote(
  organizationId: string,
  tenantId: string,
  noteId: string
) {
  const updated = await db
    .update(user)
    .set({
      metadata: sql`jsonb_set(${user.metadata}, '{notes}', coalesce((select jsonb_agg(n) from jsonb_array_elements(${notesArray}) as n where n->>'id' <> ${noteId}), '[]'::jsonb))`,
    })
    .where(
      and(
        ownTenantRow(organizationId, tenantId),
        sql`${notesArray} @> jsonb_build_array(jsonb_build_object('id', ${noteId}::text))`
      )
    )
    .returning({ id: user.id })

  if (updated.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: "Note not found." })
  }
}
