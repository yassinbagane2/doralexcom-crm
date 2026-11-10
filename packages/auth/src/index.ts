import { passkey } from "@better-auth/passkey"
import { db } from "@workspace/db"
import * as schema from "@workspace/db/schema"
import { and, asc, eq, inArray } from "drizzle-orm"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
import { admin } from "better-auth/plugins/admin"
import { emailOTP } from "better-auth/plugins/email-otp"
import { openAPI } from "better-auth/plugins/open-api"
import { organization } from "better-auth/plugins/organization"
import { twoFactor } from "better-auth/plugins/two-factor"

import { customDomainOrigins } from "./custom-domains"
import {
  OTP_EXPIRES_IN,
  sendInvitationResponse,
  sendVerificationOTP,
} from "./email"
import { env } from "./env"
import {
  hasLegalIdentifiers,
  INVITATION_EXPIRES_IN_DAYS,
  INVITATION_ROLE,
  isLegalStructure,
  isOrganizationType,
  isValidIban,
  normalizeIban,
  ORGANIZATION_LIMITS,
  organizationAc,
  organizationAdditionalFields,
  organizationRoles,
} from "./organization"
import {
  ac,
  ASSIGNABLE_ROLES,
  DEFAULT_USER_ROLE,
  getUserRole,
  roles,
} from "./roles"
import {
  findPasswordViolation,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./password"

const APP_NAME = "Tenora"
const isProduction = process.env.NODE_ENV === "production"

/** Endpoints that set a new password, mapped to the body field carrying it. */
const PASSWORD_FIELD_BY_PATH: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
  "/email-otp/reset-password": "password",
  "/admin/create-user": "password",
  "/admin/set-user-password": "newPassword",
}

const appUrl = new URL(env.NEXT_PUBLIC_APP_URL)

const authOptions = {
  appName: APP_NAME,
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // The web app calls the API from another origin; nothing else may. A
  // business's verified domain serves the same app, so it counts too.
  trustedOrigins: async () => [appUrl.origin, ...(await customDomainOrigins())],
  emailAndPassword: {
    enabled: true,
    // No public sign-up: admins create businesses, businesses create users.
    // The one exception is someone accepting a collaborator invitation, which
    // `databaseHooks.user.create` checks before the account is made.
    disableSignUp: false,
    autoSignIn: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // A reset signs out every device. Changing a password does the same via
    // `revokeOtherSessions`, which the client sends with the request.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Delivered as a one-time code: emailOTP below overrides the default link.
    // Not on sign-up: the only sign-up is through an emailed invitation, which
    // already proves the address.
    sendOnSignUp: false,
  },
  user: {
    deleteUser: { enabled: true },
    additionalFields: {
      /**
       * What a business records about a customer (a `user` account): phone,
       * mailing address, other contacts. Written only by the API's customer
       * router: never accepted from sign-up or updateUser, and never sent to
       * the client with the session.
       */
      metadata: {
        type: "json",
        required: false,
        input: false,
        returned: false,
      },
    },
  },
  session: {
    // Lets proxy.ts and server components read the session without a DB hit.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    database: { generateId: "uuid" },
    crossSubDomainCookies: {
      enabled: Boolean(env.AUTH_COOKIE_DOMAIN),
      domain: env.AUTH_COOKIE_DOMAIN,
    },
    defaultCookieAttributes: {
      // The web app and API are same-site (localhost, or subdomains of one
      // domain), so Lax is enough and keeps cross-site requests cookieless.
      sameSite: "lax",
      secure: isProduction,
      httpOnly: true,
    },
  },
  plugins: [
    emailOTP({
      expiresIn: OTP_EXPIRES_IN,
      allowedAttempts: 5,
      // Routes `emailVerification` through these codes. Sign-up sending is then
      // controlled by `emailVerification.sendOnSignUp`, not this plugin.
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP(data) {
        sendVerificationOTP(data)
      },
    }),
    twoFactor({ issuer: APP_NAME }),
    admin({
      ac,
      roles,
      defaultRole: DEFAULT_USER_ROLE,
      adminRoles: ["admin"],
      bannedUserMessage: "Your account has been suspended.",
    }),
    organization({
      // One organization per business; the onboarding screen creates it.
      organizationLimit: 1,
      // Users join their business's organization, they never start their own.
      allowUserToCreateOrganization: async (user) =>
        getUserRole((user as { role?: string | null }).role) === "business",
      // Owners run the organization; collaborators and customers can't change
      // it or its members through Better Auth's endpoints.
      ac: organizationAc,
      roles: organizationRoles,
      creatorRole: "owner",
      invitationExpiresIn: INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60,
      // Inviting the same email again replaces the pending invitation.
      cancelPendingInvitationsOnReInvite: true,
      // Invitation ids are random UUIDs, sent only to the invited address.
      requireEmailVerificationOnInvitation: false,
      // No `sendInvitationEmail`: the API's collaborator router creates the
      // invitation and emails it through the business's own email service.
      schema: {
        organization: { additionalFields: organizationAdditionalFields },
      },
      // Better Auth stores enum-typed additional fields without checking them.
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => ({
          data: normalizeOrganizationFields(organization, {
            requireType: true,
          }),
        }),
        beforeUpdateOrganization: async ({ organization }) => ({
          data: normalizeOrganizationFields(organization, {
            requireType: false,
          }),
        }),
        // Invitations bring in collaborators, and only people whose account
        // can become one: a new email, or a business account without a
        // business of its own.
        beforeCreateInvitation: async ({ invitation }) => {
          if (invitation.role !== INVITATION_ROLE) {
            throw new APIError("BAD_REQUEST", {
              code: "INVITATION_ROLE_NOT_ALLOWED",
              message: "Invitations can only add collaborators",
            })
          }
          const existing = await db.query.user.findFirst({
            where: eq(schema.user.email, invitation.email.toLowerCase()),
            columns: { id: true, role: true },
          })
          if (existing && !(await canJoinAsCollaborator(existing))) {
            throw new APIError("BAD_REQUEST", {
              code: "EMAIL_HAS_ACCOUNT",
              message: "That email already has an account elsewhere",
            })
          }
        },
        beforeAcceptInvitation: async ({ user }) => {
          if (!(await canJoinAsCollaborator(user))) {
            throw new APIError("FORBIDDEN", {
              code: "ACCOUNT_CANNOT_JOIN",
              message: "This account can't join another business",
            })
          }
        },
        afterAcceptInvitation: async ({ invitation, organization }) => {
          await notifyOwners(organization, invitation.email, true)
        },
        afterRejectInvitation: async ({ invitation, organization }) => {
          await notifyOwners(organization, invitation.email, false)
        },
        // A collaborator's account exists for this business alone: removing
        // them deletes it, signing them out everywhere, rather than leaving a
        // business account free to set up a business of its own.
        afterRemoveMember: async ({ member, user }) => {
          if (member.role !== INVITATION_ROLE) return
          if (
            getUserRole((user as { role?: string | null }).role) !== "business"
          )
            return
          const remaining = await db.query.member.findFirst({
            where: eq(schema.member.userId, user.id),
            columns: { id: true },
          })
          if (!remaining) {
            await db.delete(schema.user).where(eq(schema.user.id, user.id))
          }
        },
      },
    }),
    passkey({
      rpName: APP_NAME,
      // WebAuthn ceremonies run on the web app, not on the API host.
      rpID: appUrl.hostname,
      origin: appUrl.origin,
    }),
    openAPI(),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          if (ctx?.path !== "/sign-up/email") return
          return { data: await acceptSignUpInvitation(user, ctx.query) }
        },
      },
      delete: {
        // Memberships go with the user (FK cascade), but an organization they
        // own would be left behind with nobody able to manage it. Remove those,
        // unless someone else also owns it. A hook rather than
        // `deleteUser.beforeDelete`, so an admin removing a business counts too.
        before: async (user) => {
          await deleteSolelyOwnedOrganizations(user.id)
        },
      },
    },
    session: {
      create: {
        // A new session starts in the user's first organization, so pages can
        // rely on `activeOrganizationId` instead of looking it up each time.
        before: async (session) => ({
          data: {
            ...session,
            activeOrganizationId: await findFirstOrganizationId(session.userId),
          },
        }),
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/admin/set-role") {
        await assertRoleChangeAllowed(ctx)
        return
      }

      const field = PASSWORD_FIELD_BY_PATH[ctx.path]
      if (!field) return

      const password = (ctx.body as Record<string, unknown> | undefined)?.[
        field
      ]
      if (typeof password !== "string") return

      const violation = findPasswordViolation(password)
      if (violation) {
        throw new APIError("BAD_REQUEST", {
          code: "PASSWORD_POLICY",
          message: violation,
        })
      }
    }),
  },
} satisfies BetterAuthOptions

export const auth = betterAuth(authOptions)

/**
 * The admin plugin lets any admin set any role on anyone, itself included. An
 * admin changing their own role could remove the last admin and lock everyone
 * out of the dashboard, so that is refused. Another admin can still do it, so
 * at least one admin always remains: the one making the change.
 */
async function assertRoleChangeAllowed(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]
) {
  const body = ctx.body as { userId?: unknown; role?: unknown } | undefined
  const requested = Array.isArray(body?.role) ? body.role : [body?.role]

  // Not an admin session: the endpoint's own middleware rejects it.
  const session = await getSessionFromCtx(ctx)
  if (!session || typeof body?.userId !== "string") return

  if (body.userId === session.user.id) {
    throw new APIError("FORBIDDEN", {
      code: "CANNOT_CHANGE_OWN_ROLE",
      message: "You can't change your own role",
    })
  }

  const assignable: readonly unknown[] = ASSIGNABLE_ROLES
  if (!requested.every((role) => assignable.includes(role))) {
    throw new APIError("BAD_REQUEST", {
      code: "ROLE_NOT_ASSIGNABLE",
      message: "That role can't be assigned from the dashboard",
    })
  }
}

const OPTIONAL_TEXT_FIELDS = [
  "taxId",
  "registrationNumber",
  "legalStructure",
  "address",
  "vatNumber",
  "bankName",
  "iban",
] as const

function invalidField(code: string, message: string): never {
  throw new APIError("BAD_REQUEST", { code, message })
}

/**
 * Checks the business details Better Auth would otherwise store as sent: the
 * legal structure must be a known one, text fits its column, the IBAN's check
 * digits add up. An emptied field is stored as "not set".
 */
function normalizeBusinessDetails(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {}

  for (const field of OPTIONAL_TEXT_FIELDS) {
    const value = data[field]
    if (value === undefined) continue
    if (value === null || value === "") {
      result[field] = null
      continue
    }
    if (typeof value !== "string") {
      invalidField("INVALID_ORGANIZATION_FIELD", `${field} must be text`)
    }
    result[field] = value.trim() || null
  }

  const { legalStructure, address, vatNumber, bankName, iban } = result
  if (legalStructure != null && !isLegalStructure(legalStructure)) {
    invalidField("INVALID_LEGAL_STRUCTURE", "Unknown legal structure")
  }
  const tooLong = (value: unknown, max: number) =>
    typeof value === "string" && value.length > max
  if (
    tooLong(address, ORGANIZATION_LIMITS.address) ||
    tooLong(bankName, ORGANIZATION_LIMITS.bankName) ||
    tooLong(vatNumber, ORGANIZATION_LIMITS.vatNumber) ||
    tooLong(result.registrationNumber, ORGANIZATION_LIMITS.registrationNumber)
  ) {
    invalidField("ORGANIZATION_FIELD_TOO_LONG", "A business detail is too long")
  }
  if (typeof vatNumber === "string") {
    result.vatNumber = vatNumber.replace(/\s+/g, "").toUpperCase()
  }
  if (typeof iban === "string") {
    if (!isValidIban(iban))
      invalidField("INVALID_IBAN", "That IBAN isn't valid")
    result.iban = normalizeIban(iban)
  }

  return result
}

/**
 * Rejects an unknown organization type, and clears identifiers that are empty
 * or don't apply to it: a personal landlord has no fiscal code, only businesses register with
 * the trade register.
 */
function normalizeOrganizationFields(
  data: Record<string, unknown>,
  { requireType }: { requireType: boolean }
) {
  const { type } = data

  const cleared = normalizeBusinessDetails(data)

  if (type === undefined && !requireType) return cleared

  if (!isOrganizationType(type)) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_ORGANIZATION_TYPE",
      message: "Organization type must be personal, business or institution",
    })
  }

  return {
    ...cleared,
    ...(hasLegalIdentifiers(type) ? {} : { taxId: null }),
    ...(type === "business" ? {} : { registrationNumber: null }),
  }
}

/**
 * Whether an account may become a collaborator: a business account that
 * doesn't already belong to a business. Admins, customers and anyone already
 * working somewhere can't; the app has one business per account.
 */
async function canJoinAsCollaborator(user: {
  id: string
  role?: string | null
}) {
  if (getUserRole(user.role) !== "business") return false
  const membership = await db.query.member.findFirst({
    where: eq(schema.member.userId, user.id),
    columns: { id: true },
  })
  return !membership
}

function invitationError(code: string, message: string): never {
  throw new APIError("BAD_REQUEST", { code, message })
}

/**
 * Sign-up is open only to the person a pending invitation was sent to, who
 * passes its id as `?invitationId=`. Their account is a business account, and
 * their email counts as verified: the invitation reached it. The client then
 * accepts the invitation to join.
 */
async function acceptSignUpInvitation<T extends { email: string }>(
  user: T,
  query: unknown
) {
  const invitationId = (query as { invitationId?: unknown } | undefined)
    ?.invitationId
  if (
    typeof invitationId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(invitationId)
  ) {
    invitationError("INVITATION_REQUIRED", "Sign-up needs an invitation")
  }

  const invitation = await db.query.invitation.findFirst({
    where: eq(schema.invitation.id, invitationId),
    columns: { email: true, status: true, expiresAt: true, role: true },
  })
  if (!invitation || invitation.status !== "pending") {
    invitationError(
      "INVITATION_NOT_FOUND",
      "This invitation is no longer valid"
    )
  }
  if (invitation.expiresAt < new Date()) {
    invitationError("INVITATION_EXPIRED", "This invitation has expired")
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    invitationError(
      "INVITATION_EMAIL_MISMATCH",
      "Sign up with the email the invitation was sent to"
    )
  }

  return { ...user, role: "business", emailVerified: true }
}

async function notifyOwners(
  organization: { id: string; name: string },
  inviteeEmail: string,
  accepted: boolean
) {
  const owners = await db
    .select({ name: schema.user.name, email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(
      and(
        eq(schema.member.organizationId, organization.id),
        eq(schema.member.role, "owner")
      )
    )

  for (const owner of owners) {
    sendInvitationResponse({
      to: owner.email,
      ownerName: owner.name,
      inviteeEmail,
      organizationName: organization.name,
      accepted,
    })
  }
}

async function findFirstOrganizationId(userId: string) {
  const membership = await db.query.member.findFirst({
    where: eq(schema.member.userId, userId),
    orderBy: asc(schema.member.createdAt),
    columns: { organizationId: true },
  })

  return membership?.organizationId ?? null
}

async function deleteSolelyOwnedOrganizations(userId: string) {
  const owned = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(
      and(eq(schema.member.userId, userId), eq(schema.member.role, "owner"))
    )

  if (owned.length === 0) return

  const ownedIds = owned.map((row) => row.organizationId)
  const owners = await db
    .select({
      organizationId: schema.member.organizationId,
      userId: schema.member.userId,
    })
    .from(schema.member)
    .where(
      and(
        inArray(schema.member.organizationId, ownedIds),
        eq(schema.member.role, "owner")
      )
    )

  const soleOwned = ownedIds.filter((id) =>
    owners.every((row) => row.organizationId !== id || row.userId === userId)
  )

  if (soleOwned.length === 0) return

  // Collaborator accounts exist only to work in the owner's business: they
  // go with it rather than being left without one.
  const collaborators = await db
    .select({ userId: schema.member.userId })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(
      and(
        inArray(schema.member.organizationId, soleOwned),
        eq(schema.member.role, "collaborator"),
        eq(schema.user.role, "business")
      )
    )
  if (collaborators.length > 0) {
    await db.delete(schema.user).where(
      inArray(
        schema.user.id,
        collaborators.map((row) => row.userId)
      )
    )
  }

  await db
    .delete(schema.organization)
    .where(inArray(schema.organization.id, soleOwned))
}

export type Session = typeof auth.$Infer.Session
export type User = Session["user"]
