import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { property, propertyPhoto } from "@workspace/db/schema"
import { and, asc, count, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { discardPropertyPhotos, propertyPhotoLocation } from "../lib/storage"
import { isPropertyPhotoType, PROPERTY_PHOTO_LIMITS } from "../property"

function propertyNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Property not found.",
    data: { code: "PROPERTY_NOT_FOUND" },
  })
}

function photoNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Photo not found.",
    data: { code: "PHOTO_NOT_FOUND" },
  })
}

/** One of the organization's photos, by id. */
const ownPhoto = (organizationId: string, id: string) =>
  and(
    eq(propertyPhoto.id, id),
    eq(propertyPhoto.organizationId, organizationId)
  )

async function assertOwnProperty(organizationId: string, propertyId: string) {
  const [found] = await db
    .select({ id: property.id })
    .from(property)
    .where(
      and(
        eq(property.id, propertyId),
        eq(property.organizationId, organizationId)
      )
    )
  if (!found) throw propertyNotFound()
}

/**
 * The photos of a business's properties. Listing them is part of the
 * property itself (property.get); the images are served by `file`, which
 * the API server also exposes as a plain GET for <img> tags.
 */
export const propertyPhotoRouter = o.prefix("/property-photos").router({
  /** Adds a photo after the property's others. */
  upload: businessProcedure
    .route({ method: "POST", path: "/", tags: ["properties"] })
    .input(z.object({ propertyId: z.uuid(), file: z.file() }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { file, propertyId } = input
      const organizationId = context.organizationId
      if (!isPropertyPhotoType(file.type)) {
        throw new ORPCError("UNSUPPORTED_MEDIA_TYPE", {
          message: "Photos must be JPEG, PNG or WebP images.",
          data: { code: "PHOTO_TYPE" },
        })
      }
      if (file.size === 0 || file.size > PROPERTY_PHOTO_LIMITS.fileBytes) {
        throw new ORPCError("PAYLOAD_TOO_LARGE", {
          message: "The photo is empty or too large.",
          data: { code: "PHOTO_SIZE" },
        })
      }
      await assertOwnProperty(organizationId, propertyId)

      const [counted] = await db
        .select({ total: count() })
        .from(propertyPhoto)
        .where(eq(propertyPhoto.propertyId, propertyId))
      if ((counted?.total ?? 0) >= PROPERTY_PHOTO_LIMITS.perProperty) {
        throw new ORPCError("CONFLICT", {
          message: "This property has as many photos as it can hold.",
          data: { code: "PHOTO_LIMIT" },
        })
      }

      // The image goes to R2 first: a row never points at a missing image.
      const photo = { id: crypto.randomUUID(), organizationId, propertyId }
      const { storage, key } = propertyPhotoLocation(photo)
      await storage.upload({
        key,
        body: new Uint8Array(await file.arrayBuffer()),
        contentType: file.type,
      })

      try {
        await db.insert(propertyPhoto).values({
          ...photo,
          position: sql`(select coalesce(max(${propertyPhoto.position}) + 1, 0) from ${propertyPhoto} where ${propertyPhoto.propertyId} = ${propertyId})`,
          mimeType: file.type,
          size: file.size,
        })
      } catch (error) {
        await discardPropertyPhotos([photo])
        throw error
      }

      return { id: photo.id }
    }),

  /**
   * Puts a property's photos in the order given, which must name each of
   * them once. The first one becomes the cover.
   */
  reorder: businessProcedure
    .route({ method: "PUT", path: "/order", tags: ["properties"] })
    .input(
      z.object({
        propertyId: z.uuid(),
        ids: z.array(z.uuid()).max(PROPERTY_PHOTO_LIMITS.perProperty),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      await assertOwnProperty(context.organizationId, input.propertyId)

      await db.transaction(async (tx) => {
        const photos = await tx
          .select({ id: propertyPhoto.id })
          .from(propertyPhoto)
          .where(eq(propertyPhoto.propertyId, input.propertyId))
          .for("update")

        const wanted = new Set(input.ids)
        if (
          wanted.size !== input.ids.length ||
          photos.length !== wanted.size ||
          photos.some((photo) => !wanted.has(photo.id))
        ) {
          // Someone added or removed a photo since this order was put
          // together: the caller should reload and try again.
          throw new ORPCError("CONFLICT", {
            message: "The photos changed in the meantime.",
            data: { code: "PHOTOS_CHANGED" },
          })
        }

        await Promise.all(
          input.ids.map((id, position) =>
            tx
              .update(propertyPhoto)
              .set({ position })
              .where(eq(propertyPhoto.id, id))
          )
        )
      })

      return { success: true }
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["properties"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(propertyPhoto)
        .where(ownPhoto(context.organizationId, input.id))
        .returning({
          id: propertyPhoto.id,
          organizationId: propertyPhoto.organizationId,
          propertyId: propertyPhoto.propertyId,
        })

      if (deleted.length === 0) throw photoNotFound()
      await discardPropertyPhotos(deleted)
      return { success: true }
    }),

  /** The image itself. */
  file: businessProcedure
    .route({ method: "GET", path: "/{id}", tags: ["properties"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.file())
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select()
        .from(propertyPhoto)
        .where(ownPhoto(context.organizationId, input.id))

      if (!found) throw photoNotFound()
      const { storage, key } = propertyPhotoLocation(found)
      const bytes = await storage.getObjectBytes(key)
      if (!bytes) throw photoNotFound()
      return new File([new Uint8Array(bytes)], found.id, {
        type: found.mimeType,
      })
    }),
})

/** Each property's photos, in order, for the properties given. */
export async function photosOf(propertyIds: string[]) {
  if (propertyIds.length === 0) return new Map<string, { id: string }[]>()
  const rows = await db
    .select({ id: propertyPhoto.id, propertyId: propertyPhoto.propertyId })
    .from(propertyPhoto)
    .where(inArray(propertyPhoto.propertyId, propertyIds))
    .orderBy(asc(propertyPhoto.position), asc(propertyPhoto.createdAt))

  const byProperty = new Map<string, { id: string }[]>()
  for (const row of rows) {
    const list = byProperty.get(row.propertyId) ?? []
    list.push({ id: row.id })
    byProperty.set(row.propertyId, list)
  }
  return byProperty
}
