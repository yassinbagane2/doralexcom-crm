import { ORPCError } from "@orpc/server"
import { db } from "@workspace/db"
import { member, property, user } from "@workspace/db/schema"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o } from "../index"
import { PROPERTY_LIMITS, PROPERTY_TYPES, RENT_CURRENCIES } from "../property"

/** Blank text is stored as null, so "not set" has one spelling. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

const optionalAmount = (max: number) =>
  z.number().finite().nonnegative().max(max).nullable()

const propertyInput = z.object({
  type: z.enum(PROPERTY_TYPES),
  name: z.string().trim().min(1).max(PROPERTY_LIMITS.name),
  address: z.string().trim().min(1).max(PROPERTY_LIMITS.address),
  surfaceArea: optionalAmount(PROPERTY_LIMITS.surfaceArea),
  description: optionalText(PROPERTY_LIMITS.description),
  doorCode: optionalText(PROPERTY_LIMITS.doorCode),
  phone: optionalText(PROPERTY_LIMITS.phone),
  rent: optionalAmount(PROPERTY_LIMITS.rent),
  currency: z.enum(RENT_CURRENCIES),
  tenantId: z.uuid().nullable(),
})

const propertySchema = z.object({
  id: z.string(),
  type: z.enum(PROPERTY_TYPES),
  name: z.string(),
  address: z.string(),
  surfaceArea: z.number().nullable(),
  description: z.string().nullable(),
  doorCode: z.string().nullable(),
  phone: z.string().nullable(),
  rent: z.number().nullable(),
  currency: z.enum(RENT_CURRENCIES),
  tenant: z
    .object({ id: z.string(), name: z.string(), email: z.string() })
    .nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

/**
 * Tenants are the `user` accounts this business created, the same ones it
 * manages on its users page. Never itself, another business, or an admin.
 */
async function assertTenant(organizationId: string, tenantId: string | null) {
  if (!tenantId) return

  const [tenant] = await db
    .select({ role: user.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, tenantId)
      )
    )
    .limit(1)

  if (!tenant || tenant.role !== "user") {
    throw new ORPCError("BAD_REQUEST", {
      message: "That tenant isn't one of your users.",
      data: { code: "TENANT_NOT_FOUND" },
    })
  }
}

function notFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Property not found.",
    data: { code: "PROPERTY_NOT_FOUND" },
  })
}

/**
 * The properties a business rents out. Like the business router, nothing here
 * reaches outside `context.organizationId`.
 */
export const propertyRouter = o.prefix("/properties").router({
  list: businessProcedure
    .route({ method: "GET", path: "/", tags: ["properties"] })
    .output(z.array(propertySchema))
    .handler(async ({ context }) => {
      const rows = await db
        .select({
          property,
          tenant: { id: user.id, name: user.name, email: user.email },
        })
        .from(property)
        .leftJoin(user, eq(user.id, property.tenantId))
        .where(eq(property.organizationId, context.organizationId))
        .orderBy(desc(property.createdAt))

      return rows.map(({ property: row, tenant }) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        address: row.address,
        surfaceArea: row.surfaceArea,
        description: row.description,
        doorCode: row.doorCode,
        phone: row.phone,
        rent: row.rent,
        currency: row.currency,
        tenant,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
    }),

  create: businessProcedure
    .route({ method: "POST", path: "/", tags: ["properties"] })
    .input(propertyInput)
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      await assertTenant(context.organizationId, input.tenantId)

      const [created] = await db
        .insert(property)
        .values({ ...input, organizationId: context.organizationId })
        .returning({ id: property.id })

      return { id: created!.id }
    }),

  update: businessProcedure
    .route({ method: "PUT", path: "/{id}", tags: ["properties"] })
    .input(propertyInput.extend({ id: z.uuid() }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { id, ...values } = input
      await assertTenant(context.organizationId, values.tenantId)

      const [updated] = await db
        .update(property)
        .set(values)
        .where(
          and(
            eq(property.id, id),
            eq(property.organizationId, context.organizationId)
          )
        )
        .returning({ id: property.id })

      if (!updated) throw notFound()

      return { id: updated.id }
    }),

  remove: businessProcedure
    .route({ method: "DELETE", path: "/{id}", tags: ["properties"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const scope = and(
        eq(property.id, input.id),
        eq(property.organizationId, context.organizationId)
      )

      // The vacancy check and the delete are one statement, so a tenant
      // assigned a moment ago can't slip past it.
      const deleted = await db
        .delete(property)
        .where(and(scope, isNull(property.tenantId)))
        .returning({ id: property.id })

      if (deleted.length > 0) return { success: true }

      const existing = await db.query.property.findFirst({
        where: scope,
        columns: { id: true },
      })

      if (!existing) throw notFound()

      throw new ORPCError("CONFLICT", {
        message: "This property has a tenant. Remove them before deleting it.",
        data: { code: "PROPERTY_IN_USE" },
      })
    }),
})
