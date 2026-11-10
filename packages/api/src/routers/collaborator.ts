import { ORPCError } from "@orpc/server"
import { auth } from "@workspace/auth"
import {
  INVITATION_EXPIRES_IN_DAYS,
  INVITATION_ROLE,
} from "@workspace/auth/organization"
import { db } from "@workspace/db"
import {
  customDomain,
  invitation,
  member,
  organization,
  session,
  user,
} from "@workspace/db/schema"
import { and, asc, eq, inArray, max } from "drizzle-orm"
import { z } from "zod"

import { env } from "../env"
import { businessProcedure, o, ownerProcedure, publicProcedure } from "../index"
import { callAuth } from "../lib/auth-error"
import { deliveryFailed, sendOrganizationEmail } from "../lib/mailer"

/*
 * Collaborators: other `business` accounts working on the organization's
 * records. The owner invites them through Better Auth's organization plugin;
 * the invitation is emailed from here so it goes out through the business's
 * own email service. The invitee accepts on /invite/{id}, creating their
 * account there if they don't have one. Listing invitations, cancelling them
 * and removing members go straight to the plugin from the web app.
 */

const collaboratorSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["owner", "collaborator"]),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  lastActiveAt: z.date().nullable(),
})

function invitationNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Invitation not found.",
    data: { code: "INVITATION_NOT_FOUND" },
  })
}

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
  invite: { id: string; email: string },
  inviter: { name: string; email: string }
) {
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
  const businessName = org?.name ?? "their business"
  const link = new URL(`/invite/${invite.id}`, await appOrigin(organizationId))

  await sendOrganizationEmail(organizationId, {
    to: invite.email,
    subject: `${inviter.name} invited you to join ${businessName}`,
    text: [
      `Hi,`,
      `${inviter.name} (${inviter.email}) invited you to work with them on ${businessName}: its properties, customers, contracts and payments.`,
      `Accept the invitation:\n${link.toString()}`,
      `It expires in ${INVITATION_EXPIRES_IN_DAYS} days. If you weren't expecting this, you can ignore this email.`,
    ].join("\n\n"),
  })
}

/** Creates (or, with `resend`, renews) an invitation through Better Auth. */
function createInvitation(
  headers: Headers,
  organizationId: string,
  email: string,
  resend = false
) {
  return callAuth(() =>
    auth.api.createInvitation({
      headers,
      body: { email, role: INVITATION_ROLE, organizationId, resend },
    })
  )
}

const invitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "canceled",
  "expired",
])

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
          memberId: member.id,
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
    .route({ method: "POST", path: "/invitations", tags: ["collaborators"] })
    .input(
      z.object({
        email: z.email().transform((email) => email.toLowerCase()),
      })
    )
    .output(z.object({ id: z.string(), emailSent: z.boolean() }))
    .handler(async ({ input, context }) => {
      const created = await createInvitation(
        context.headers,
        context.organizationId,
        input.email
      )

      // The invitation stands either way; a failed email can be resent.
      const emailSent = await sendInvitation(
        context.organizationId,
        created,
        context.session.user
      ).then(
        () => true,
        (error: unknown) => {
          console.error("[collaborators] Invitation not sent:", error)
          return false
        }
      )

      return { id: created.id, emailSent }
    }),

  /**
   * Emails the invitation again. A pending one keeps its link and gets a
   * fresh expiry; an expired, declined or canceled one is replaced.
   */
  resendInvitation: ownerProcedure
    .route({
      method: "POST",
      path: "/invitations/{invitationId}/resend",
      tags: ["collaborators"],
    })
    .input(z.object({ invitationId: z.uuid() }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const found = await db.query.invitation.findFirst({
        where: and(
          eq(invitation.id, input.invitationId),
          eq(invitation.organizationId, context.organizationId),
          inArray(invitation.status, ["pending", "rejected", "canceled"])
        ),
        columns: { email: true },
      })
      if (!found) throw invitationNotFound()

      const renewed = await createInvitation(
        context.headers,
        context.organizationId,
        found.email,
        true
      )
      await sendInvitation(
        context.organizationId,
        renewed,
        context.session.user
      ).catch(deliveryFailed)

      return { id: renewed.id }
    }),
})

/**
 * What the invitation page shows to whoever holds the link, signed in or not.
 * The id is a random UUID that only went to the invited address.
 */
export const invitationRouter = o.prefix("/invitations").router({
  get: publicProcedure
    .route({ method: "GET", path: "/{invitationId}", tags: ["invitations"] })
    .input(z.object({ invitationId: z.string() }))
    .output(
      z.object({
        id: z.string(),
        email: z.string(),
        role: z.string(),
        status: invitationStatusSchema,
        expiresAt: z.date(),
        organizationName: z.string(),
        inviter: z.object({ name: z.string(), email: z.string() }),
        inviteeHasAccount: z.boolean(),
      })
    )
    .handler(async ({ input }) => {
      if (!z.uuid().safeParse(input.invitationId).success) {
        throw invitationNotFound()
      }

      const [found] = await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          organizationName: organization.name,
          inviterName: user.name,
          inviterEmail: user.email,
        })
        .from(invitation)
        .innerJoin(organization, eq(organization.id, invitation.organizationId))
        .innerJoin(user, eq(user.id, invitation.inviterId))
        .where(eq(invitation.id, input.invitationId))
      if (!found) throw invitationNotFound()

      const invitee = await db.query.user.findFirst({
        where: eq(user.email, found.email.toLowerCase()),
        columns: { id: true },
      })

      const status = invitationStatusSchema
        .catch("canceled")
        .parse(found.status)

      return {
        id: found.id,
        email: found.email,
        role: found.role ?? INVITATION_ROLE,
        status:
          status === "pending" && found.expiresAt < new Date()
            ? "expired"
            : status,
        expiresAt: found.expiresAt,
        organizationName: found.organizationName,
        inviter: { name: found.inviterName, email: found.inviterEmail },
        inviteeHasAccount: Boolean(invitee),
      }
    }),
})
