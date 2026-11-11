import { LEGAL_STRUCTURES } from "@workspace/auth/organization"
import { db } from "@workspace/db"
import { member, organization, user } from "@workspace/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

/** The landlord as contracts and receipts print it. */
export const landlordSchema = z.object({
  name: z.string(),
  representative: z.string().nullable(),
  email: z.string().nullable(),
  legalStructure: z.enum(LEGAL_STRUCTURES).nullable(),
  address: z.string().nullable(),
  taxId: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  vatNumber: z.string().nullable(),
  bankName: z.string().nullable(),
  iban: z.string().nullable(),
})

export type Landlord = z.infer<typeof landlordSchema>

/**
 * The landlord is the business: its organization, with the details entered
 * in its settings, signed for by the account that owns it.
 */
export async function findLandlord(organizationId: string): Promise<Landlord> {
  const [found] = await db
    .select({
      name: organization.name,
      legalStructure: organization.legalStructure,
      address: organization.address,
      taxId: organization.taxId,
      registrationNumber: organization.registrationNumber,
      vatNumber: organization.vatNumber,
      bankName: organization.bankName,
      iban: organization.iban,
      representative: user.name,
      email: user.email,
    })
    .from(organization)
    .leftJoin(
      member,
      and(eq(member.organizationId, organization.id), eq(member.role, "owner"))
    )
    .leftJoin(user, eq(user.id, member.userId))
    .where(eq(organization.id, organizationId))
    .orderBy(asc(member.createdAt))
    .limit(1)

  return {
    name: found?.name ?? "",
    representative: found?.representative ?? null,
    email: found?.email ?? null,
    legalStructure: found?.legalStructure ?? null,
    address: found?.address ?? null,
    taxId: found?.taxId ?? null,
    registrationNumber: found?.registrationNumber ?? null,
    vatNumber: found?.vatNumber ?? null,
    bankName: found?.bankName ?? null,
    iban: found?.iban ?? null,
  }
}

/** Where to tell the business about something its customer did: its owners. */
export async function ownerEmails(organizationId: string) {
  const owners = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner"))
    )
  return owners.map((owner) => owner.email)
}
