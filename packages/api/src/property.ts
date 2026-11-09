/*
 * What a property can be, and what its rent is counted in. Shared by the
 * property router and the web forms, so keep this file free of server
 * imports: it ends up in client bundles. The database columns repeat these
 * lists (packages/db/src/schema/property.ts).
 */

export const PROPERTY_TYPES = [
  "apartment",
  "building",
  "office",
  "garage",
  "parking",
  "other",
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const RENT_CURRENCIES = ["RON", "EUR"] as const

export type RentCurrency = (typeof RENT_CURRENCIES)[number]

export const PROPERTY_LIMITS = {
  name: 100,
  address: 300,
  description: 2000,
  doorCode: 50,
  phone: 30,
  /** Fits numeric(10, 2) and numeric(12, 2) with room to spare. */
  surfaceArea: 99_999_999,
  rent: 9_999_999_999,
} as const
