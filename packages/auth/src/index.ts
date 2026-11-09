import { passkey } from "@better-auth/passkey"
import { db } from "@workspace/db"
import * as schema from "@workspace/db/schema"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { emailOTP } from "better-auth/plugins/email-otp"
import { openAPI } from "better-auth/plugins/open-api"
import { twoFactor } from "better-auth/plugins/two-factor"

import { OTP_EXPIRES_IN, sendVerificationOTP } from "./email"
import { env } from "./env"
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
    passkey({
      rpName: APP_NAME,
      // WebAuthn ceremonies run on the web app, not on the API host.
      rpID: appUrl.hostname,
      origin: appUrl.origin,
    }),
    openAPI(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
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

export type Session = typeof auth.$Infer.Session
export type User = Session["user"]
