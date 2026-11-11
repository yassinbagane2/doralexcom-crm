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

/**
 * What a property's photos can be. The web app shrinks pictures before
 * uploading them, so the size limit only stops the odd original that slips
 * through unshrunk.
 */
export const PROPERTY_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type PropertyPhotoType = (typeof PROPERTY_PHOTO_TYPES)[number]

export const isPropertyPhotoType = (type: string): type is PropertyPhotoType =>
  (PROPERTY_PHOTO_TYPES as readonly string[]).includes(type)

export const PROPERTY_PHOTO_LIMITS = {
  perProperty: 30,
  fileBytes: 10 * 1024 * 1024,
} as const
