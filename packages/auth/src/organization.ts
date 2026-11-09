/*
 * What kind of landlord an organization is. Shared by the server, which stores
 * it on the organization, and the web forms that let people pick one. Keep
 * this file free of server imports: the web app pulls it into client bundles.
 */

import type { DBFieldAttribute } from "better-auth"

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
} satisfies Record<string, DBFieldAttribute>
