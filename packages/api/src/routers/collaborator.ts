import { randomBytes } from "node:crypto"

import { ORPCError } from "@orpc/server"
import { auth } from "@workspace/auth"
import { db } from "@workspace/db"
import {
  customDomain,
  member,
  organization,
  session,
  user,
} from "@workspace/db/schema"
import { and, asc, eq, exists, inArray, max, sql } from "drizzle-orm"
import { z } from "zod"

import { env } from "../env"
import { businessProcedure, o, ownerProcedure } from "../index"
import { callAuth } from "../lib/auth-error"
import { deliveryFailed, sendOrganizationEmail } from "../lib/mailer"

/*
 * Collaborators: other `business` accounts the owner lets into the
 * organization, to work on the same records. Only the owner adds or removes
 * them. Their account exists for this business alone, so removing a
 * collaborator deletes it.
 */

const collaboratorSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["owner", "collaborator"]),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  lastActiveAt: z.date().nullable(),
})

function collaboratorNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Collaborator not found.",
    data: { code: "COLLABORATOR_NOT_FOUND" },
  })
}

/** A collaborator of this organization (never its owner). */
const collaboratorOf = (organizationId: string, userId: string) =>
  and(
    eq(user.id, userId),
    eq(user.role, "business"),
    exists(
      db
        .select({ one: sql`1` })
        .from(member)
        .where(
          and(
            eq(member.userId, user.id),
            eq(member.organizationId, organizationId),
            eq(member.role, "collaborator")
          )
        )
    )
  )

/**
 * A password nobody knows, meeting the policy (an uppercase letter and a
 * special character): the collaborator chooses their own from the email.
 */
const unusablePassword = () => `${randomBytes(24).toString("base64url")}A!`

/** Where the invitation sends them: the business's own domain, if it has one. */
async function appOrigin(organizationId: string) {
  const domain = await db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.organizationId, organizationId),
      eq(customDomain.status, "active")
    ),
    columns: { hostname: true },
  })
  return domain ? `https://${domain.hostname}` : env.NEXT_PUBLIC_APP_URL
}

async function sendInvitation(
  organizationId: string,
  invitee: { name: string; email: string },
  inviterName: string
) {
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
  const link = new URL("/forgot-password", await appOrigin(organizationId))
  link.searchParams.set("email", invitee.email)
  link.searchParams.set("invited", "1")

  await sendOrganizationEmail(organizationId, {
    to: invitee.email,
    subject: `${inviterName} invited you to ${org?.name ?? "their business"}`,
    text: [
      `Hi ${invitee.name},`,
      `${inviterName} invited you to work with them on ${org?.name ?? "their business"}: its properties, tenants, contracts and payments.`,
      `Choose a password to get started:\n${link.toString()}`,
      `Your sign-in email is ${invitee.email}. If you weren't expecting this, you can ignore this email.`,
    ].join("\n\n"),
  })
}

export const collaboratorRouter = o.prefix("/collaborators").router({
  /** The owner and every collaborator. Collaborators see the list too. */
  list: businessProcedure
    .route({ method: "GET", path: "/", tags: ["collaborators"] })
    .output(z.array(collaboratorSchema))
    .handler(async ({ context }) => {
      const lastActive = db
        .select({
          userId: session.userId,
          at: max(session.updatedAt).as("last_active_at"),
        })
        .from(session)
        .groupBy(session.userId)
        .as("last_active")

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: member.role,
          emailVerified: user.emailVerified,
          createdAt: member.createdAt,
          lastActiveAt: lastActive.at,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .leftJoin(lastActive, eq(lastActive.userId, user.id))
        .where(
          and(
            eq(member.organizationId, context.organizationId),
            inArray(member.role, ["owner", "collaborator"])
          )
        )
        .orderBy(asc(member.createdAt))

      return rows.map((row) => ({
        ...row,
        role: row.role === "owner" ? "owner" : "collaborator",
      }))
    }),

  invite: ownerProcedure
    .route({ method: "POST", path: "/", tags: ["collaborators"] })
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        email: z.email().transform((email) => email.toLowerCase()),
      })
    )
    .output(z.object({ id: z.string(), emailSent: z.boolean() }))
    .handler(async ({ input, context }) => {
      const { user: created } = await callAuth(() =>
        auth.api.createUser({
          body: {
            name: input.name,
            email: input.email,
            password: unusablePassword(),
            role: "business",
          },
        })
      )

      try {
        await callAuth(() =>
          auth.api.addMember({
            body: {
              userId: created.id,
              organizationId: context.organizationId,
              role: "collaborator",
            },
          })
        )
      } catch (error) {
        // A business account outside any organization would be stranded.
        await db.delete(user).where(eq(user.id, created.id))
        throw error
      }

      // The account stands either way; a failed email can be resent.
      const emailSent = await sendInvitation(
        context.organizationId,
        input,
        context.session.user.name
      ).then(
        () => true,
        (error: unknown) => {
          console.error("[collaborators] Invitation not sent:", error)
          return false
        }
      )

      return { id: created.id, emailSent }
    }),

  resendInvitation: ownerProcedure
    .route({
      method: "POST",
      path: "/{userId}/invitation",
      tags: ["collaborators"],
    })
    .input(z.object({ userId: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const [found] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(collaboratorOf(context.organizationId, input.userId))
      if (!found) throw collaboratorNotFound()

      await sendInvitation(
        context.organizationId,
        found,
        context.session.user.name
      ).catch(deliveryFailed)
      return { success: true }
    }),

  /** Deletes the collaborator's account, signing them out everywhere. */
  remove: ownerProcedure
    .route({ method: "DELETE", path: "/{userId}", tags: ["collaborators"] })
    .input(z.object({ userId: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(user)
        .where(collaboratorOf(context.organizationId, input.userId))
        .returning({ id: user.id })

      if (deleted.length === 0) throw collaboratorNotFound()
      return { success: true }
    }),
})
