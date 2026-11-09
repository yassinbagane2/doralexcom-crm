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

import { OTP_EXPIRES_IN, sendVerificationOTP } from "./email"
import { env } from "./env"
import {
  hasLegalIdentifiers,
  isOrganizationType,
  organizationAdditionalFields,
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

const APP_NAME = "Tube"
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
  // The web app calls the API from another origin; nothing else may.
  trustedOrigins: [appUrl.origin],
  emailAndPassword: {
    enabled: true,
    // No public sign-up: admins create businesses, businesses create users.
    disableSignUp: true,
    autoSignIn: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // A reset signs out every device. Changing a password does the same via
    // `revokeOtherSessions`, which the client sends with the request.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Delivered as a one-time code: emailOTP below overrides the default link.
    sendOnSignUp: true,
  },
  user: {
    deleteUser: { enabled: true },
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

  // Forms send "" for a field the user emptied; store that as "not set".
  const cleared = {
    ...(data.taxId === "" ? { taxId: null } : {}),
    ...(data.registrationNumber === "" ? { registrationNumber: null } : {}),
  }

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

  if (soleOwned.length > 0) {
    await db
      .delete(schema.organization)
      .where(inArray(schema.organization.id, soleOwned))
  }
}

export type Session = typeof auth.$Infer.Session
export type User = Session["user"]
