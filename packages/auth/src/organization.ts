/*
 * What kind of landlord an organization is, the details it prints on
 * contracts and receipts, and who works inside it. Shared by the server, which
 * stores and enforces all of it, and the web forms. Keep this file free of
 * server imports: the web app pulls it into client bundles.
 */

import type { DBFieldAttribute } from "better-auth"
import { createAccessControl } from "better-auth/plugins/access"
import {
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access"

export const ORGANIZATION_TYPES = [
  "personal",
  "business",
  "institution",
] as const

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]

export function isOrganizationType(value: unknown): value is OrganizationType {
  return ORGANIZATION_TYPES.includes(value as OrganizationType)
}

/** Personal landlords are people, not legal entities: no company identifiers. */
export function hasLegalIdentifiers(type: OrganizationType) {
  return type !== "personal"
}

/**
 * The legal form the landlord trades under, as printed on its paperwork:
 * a private person, a sole trader (PFA / II), a limited company (SRL), a joint
 * stock company (SA), an association or foundation, or something else.
 */
export const LEGAL_STRUCTURES = [
  "individual",
  "sole_trader",
  "limited_company",
  "joint_stock_company",
  "association",
  "other",
] as const

export type LegalStructure = (typeof LEGAL_STRUCTURES)[number]

export function isLegalStructure(value: unknown): value is LegalStructure {
  return LEGAL_STRUCTURES.includes(value as LegalStructure)
}

export const ORGANIZATION_LIMITS = {
  address: 300,
  vatNumber: 32,
  bankName: 100,
  registrationNumber: 32,
} as const

/** An IBAN as people type it, without spaces and in capitals. */
export function normalizeIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase()
}

/**
 * Checks an IBAN's shape and its ISO 13616 check digits (mod 97), so a typo
 * is caught before it is printed on a receipt someone pays against.
 */
export function isValidIban(value: string) {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false

  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55)
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
}

/** Groups an IBAN in fours, the way banks print it. */
export function formatIban(value: string) {
  return normalizeIban(value).replace(/(.{4})(?=.)/g, "$1 ")
}

/**
 * Extra columns on Better Auth's `organization` table. The server plugin and
 * the web client both read this, so the two can't disagree about the shape.
 */
export const organizationAdditionalFields = {
  type: {
    // A mutable copy: Better Auth's field types reject readonly tuples.
    type: [...ORGANIZATION_TYPES] as OrganizationType[],
    required: true,
    input: true,
  },
  /** CUI / CIF — the Romanian fiscal code of a business or institution. */
  taxId: {
    type: "string",
    required: false,
    input: true,
  },
  /** Trade register number (Nr. Reg. Com.), for registered businesses. */
  registrationNumber: {
    type: "string",
    required: false,
    input: true,
  },
  legalStructure: {
    type: [...LEGAL_STRUCTURES] as LegalStructure[],
    required: false,
    input: true,
  },
  /** Registered office, or the landlord's address for a private person. */
  address: {
    type: "string",
    required: false,
    input: true,
  },
  /** VAT registration number, for landlords registered for VAT. */
  vatNumber: {
    type: "string",
    required: false,
    input: true,
  },
  /** Where tenants pay rent: the bank, and the account's IBAN. */
  bankName: {
    type: "string",
    required: false,
    input: true,
  },
  iban: {
    type: "string",
    required: false,
    input: true,
  },
} satisfies Record<string, DBFieldAttribute>

// --- Members -----------------------------------------------------------------

/**
 * A member's role inside one organization (not the account's platform role):
 *
 *   owner        — the business account that set the organization up. Edits
 *                  its details and settings, and is the only one who adds or
 *                  removes collaborators.
 *   collaborator — another `business` account the owner invited. Works on the
 *                  same records (properties, tenants, contracts…), but can't
 *                  change the organization's settings or who has access.
 *   member       — a tenant (`user` account).
 */
export const MEMBER_ROLES = ["owner", "collaborator", "member"] as const

export type MemberRole = (typeof MEMBER_ROLES)[number]

/** Members who work on the business's records. */
export const STAFF_MEMBER_ROLES = [
  "owner",
  "collaborator",
] as const satisfies readonly MemberRole[]

export function isStaffMemberRole(
  role: string | null | undefined
): role is (typeof STAFF_MEMBER_ROLES)[number] {
  return STAFF_MEMBER_ROLES.includes(role as "owner")
}

/** The only role an invitation can grant: tenants are added as tenants. */
export const INVITATION_ROLE = "collaborator" satisfies MemberRole

/** How long an invitation link stays valid, in days. */
export const INVITATION_EXPIRES_IN_DAYS = 7

/**
 * Better Auth's own organization endpoints are reachable from the browser,
 * so these permissions are what stop a collaborator from calling them to
 * edit the organization, invite people or remove members: only the owner can.
 */
export const organizationAc = createAccessControl(defaultStatements)

export const organizationRoles = {
  owner: organizationAc.newRole(ownerAc.statements),
  collaborator: organizationAc.newRole(memberAc.statements),
  member: organizationAc.newRole(memberAc.statements),
}
