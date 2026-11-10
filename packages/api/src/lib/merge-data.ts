import type { lease, property, user } from "@workspace/db/schema"
import { z } from "zod"

import { PROPERTY_TYPES, RENT_CURRENCIES } from "../property"
import { findLandlord, landlordSchema } from "./landlord"
import { readCustomerMetadata } from "./customer"

/**
 * Everything a lease's contract can mention, as stored. The web app formats
 * it in the reader's language and fills a template with it.
 */
export const mergeDataSchema = z.object({
  landlord: landlordSchema,
  customer: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
  }),
  property: z.object({
    name: z.string(),
    type: z.enum(PROPERTY_TYPES),
    address: z.string(),
    surfaceArea: z.number().nullable(),
    description: z.string().nullable(),
  }),
  lease: z.object({
    startDate: z.string(),
    endDate: z.string().nullable(),
    termMonths: z.number().nullable(),
    autoRenew: z.boolean(),
    rent: z.number(),
    charges: z.number(),
    additionalCosts: z.number(),
    discount: z.number(),
    deposit: z.number(),
    currency: z.enum(RENT_CURRENCIES),
  }),
})

export type MergeData = z.output<typeof mergeDataSchema>

type LeaseTerms = Pick<typeof lease.$inferSelect, keyof MergeData["lease"]>

/**
 * The merge data for a lease, saved or about to be: the organization's
 * landlord details, plus the customer, property and terms given.
 */
export async function buildMergeData(
  organizationId: string,
  rows: {
    customer: Pick<typeof user.$inferSelect, "name" | "email" | "metadata">
    property: typeof property.$inferSelect
    lease: LeaseTerms
  }
): Promise<MergeData> {
  const details = readCustomerMetadata(rows.customer.metadata)

  return {
    landlord: await findLandlord(organizationId),
    customer: {
      name: rows.customer.name,
      email: rows.customer.email,
      phone: details.phone,
      address: details.address,
    },
    property: {
      name: rows.property.name,
      type: rows.property.type,
      address: rows.property.address,
      surfaceArea: rows.property.surfaceArea,
      description: rows.property.description,
    },
    lease: {
      startDate: rows.lease.startDate,
      endDate: rows.lease.endDate,
      termMonths: rows.lease.termMonths,
      autoRenew: rows.lease.autoRenew,
      rent: rows.lease.rent,
      charges: rows.lease.charges,
      additionalCosts: rows.lease.additionalCosts,
      discount: rows.lease.discount,
      deposit: rows.lease.deposit,
      currency: rows.lease.currency,
    },
  }
}
