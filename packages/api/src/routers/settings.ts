import { randomBytes } from "node:crypto"

import { ORPCError } from "@orpc/server"
import { forgetCustomDomains } from "@workspace/auth/custom-domains"
import { db } from "@workspace/db"
import { customDomain, emailSettings, organization } from "@workspace/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"

import { customDomainTarget, env } from "../env"
import { o, ownerProcedure } from "../index"
import { checkDomain } from "../lib/domains"
import {
  deliver,
  deliveryFailed,
  EmailDeliveryError,
  sendOrganizationEmail,
} from "../lib/mailer"
import { openSecret, sealSecret } from "../lib/secret-box"
import {
  DOMAIN_CHALLENGE_PREFIX,
  DOMAIN_ERRORS,
  EMAIL_PROVIDERS,
  EMAIL_SETTINGS_LIMITS,
  isValidHostname,
  normalizeHostname,
} from "../settings"

/*
 * The owner's settings for the business: the email service its messages go
 * out through, and its own web address. Collaborators can't reach these.
 */

const blankToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

const optionalEmail = z
  .union([z.literal(""), z.email().max(EMAIL_SETTINGS_LIMITS.email)])
  .transform((value) => value || null)

/** Blank keeps the saved secret, so the form never has to show it. */
const secretInput = z
  .string()
  .max(EMAIL_SETTINGS_LIMITS.secret)
  .transform((value) => value.trim() || null)

const emailSettingsInput = z.discriminatedUnion("provider", [
  z.object({
    provider: z.enum(["resend", "postmark"]),
    fromName: blankToNull(EMAIL_SETTINGS_LIMITS.fromName),
    fromEmail: z.email().max(EMAIL_SETTINGS_LIMITS.email),
    replyTo: optionalEmail,
    secret: secretInput,
  }),
  z.object({
    provider: z.literal("smtp"),
    fromName: blankToNull(EMAIL_SETTINGS_LIMITS.fromName),
    fromEmail: z.email().max(EMAIL_SETTINGS_LIMITS.email),
    replyTo: optionalEmail,
    smtpHost: z.string().trim().min(1).max(EMAIL_SETTINGS_LIMITS.host),
    smtpPort: z.number().int().min(1).max(65535),
    smtpSecure: z.boolean(),
    smtpUsername: blankToNull(EMAIL_SETTINGS_LIMITS.username),
    secret: secretInput,
  }),
])

type EmailSettingsInput = z.output<typeof emailSettingsInput>

const emailSettingsOutput = z.object({
  provider: z.enum(EMAIL_PROVIDERS),
  fromName: z.string().nullable(),
  fromEmail: z.string(),
  replyTo: z.string().nullable(),
  smtpHost: z.string().nullable(),
  smtpPort: z.number().nullable(),
  smtpSecure: z.boolean(),
  smtpUsername: z.string().nullable(),
  /** False when the saved secret can no longer be decrypted. */
  secretReadable: z.boolean(),
  updatedAt: z.date(),
})

const domainOutput = z.object({
  /** What the business's DNS must point at. */
  target: z.string(),
  challengePrefix: z.string(),
  domain: z
    .object({
      hostname: z.string(),
      status: z.enum(["pending", "active"]),
      verificationToken: z.string(),
      verifiedAt: z.date().nullable(),
      lastCheckedAt: z.date().nullable(),
      lastError: z.enum(DOMAIN_ERRORS).nullable(),
    })
    .nullable(),
})

/** The platform's own hostnames, which no business can claim. */
const RESERVED_HOSTNAMES = new Set(
  [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_SERVER_URL]
    .map((url) => new URL(url).hostname)
    .concat(customDomainTarget)
)

function invalid(code: string, message: string) {
  return new ORPCError("BAD_REQUEST", { message, data: { code } })
}

/** Postgres' unique_violation, as drizzle surfaces it (possibly wrapped). */
const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string }).code === "23505" ||
  (error instanceof Error && isUniqueViolation(error.cause ?? {}))

async function readDomain(organizationId: string) {
  const found = await db.query.customDomain.findFirst({
    where: eq(customDomain.organizationId, organizationId),
  })
  return {
    target: customDomainTarget,
    challengePrefix: DOMAIN_CHALLENGE_PREFIX,
    domain: found
      ? {
          hostname: found.hostname,
          status: found.status,
          verificationToken: found.verificationToken,
          verifiedAt: found.verifiedAt,
          lastCheckedAt: found.lastCheckedAt,
          lastError: z
            .enum(DOMAIN_ERRORS)
            .nullable()
            .catch(null)
            .parse(found.lastError),
        }
      : null,
  }
}

export const settingsRouter = o.prefix("/settings").router({
  getEmail: ownerProcedure
    .route({ method: "GET", path: "/email", tags: ["settings"] })
    .output(emailSettingsOutput.nullable())
    .handler(async ({ context }) => {
      const found = await db.query.emailSettings.findFirst({
        where: eq(emailSettings.organizationId, context.organizationId),
      })
      if (!found) return null

      const { secret, organizationId: _, createdAt: __, ...rest } = found
      return { ...rest, secretReadable: openSecret(secret) !== null }
    }),

  saveEmail: ownerProcedure
    .route({ method: "PUT", path: "/email", tags: ["settings"] })
    .input(emailSettingsInput)
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input, context }) => {
      const existing = await db.query.emailSettings.findFirst({
        where: eq(emailSettings.organizationId, context.organizationId),
        columns: { provider: true, secret: true },
      })

      // A key from one provider means nothing to another: switching
      // providers needs a new one.
      const keep =
        existing?.provider === input.provider &&
        openSecret(existing.secret) !== null
      if (!input.secret && !keep) {
        throw invalid(
          "EMAIL_SECRET_REQUIRED",
          input.provider === "smtp"
            ? "Enter the SMTP password."
            : "Enter the API key."
        )
      }

      const values = {
        provider: input.provider,
        fromName: input.fromName,
        fromEmail: input.fromEmail.toLowerCase(),
        replyTo: input.replyTo?.toLowerCase() ?? null,
        smtpHost: input.provider === "smtp" ? input.smtpHost : null,
        smtpPort: input.provider === "smtp" ? input.smtpPort : null,
        smtpSecure: input.provider === "smtp" ? input.smtpSecure : false,
        smtpUsername: input.provider === "smtp" ? input.smtpUsername : null,
        ...(input.secret ? { secret: sealSecret(input.secret) } : {}),
      }

      if (existing) {
        await db
          .update(emailSettings)
          .set(values)
          .where(eq(emailSettings.organizationId, context.organizationId))
      } else {
        await db.insert(emailSettings).values({
          ...values,
          organizationId: context.organizationId,
          secret: sealSecret(input.secret!),
        })
      }

      return { success: true }
    }),

  /** Back to sending through the platform. */
  removeEmail: ownerProcedure
    .route({ method: "DELETE", path: "/email", tags: ["settings"] })
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context }) => {
      await db
        .delete(emailSettings)
        .where(eq(emailSettings.organizationId, context.organizationId))
      return { success: true }
    }),

  /**
   * Sends a test message to the owner, through the saved service, or through
   * the settings in the form before they're saved (`settings`).
   */
  testEmail: ownerProcedure
    .route({ method: "POST", path: "/email/test", tags: ["settings"] })
    .input(z.object({ settings: emailSettingsInput.nullable() }))
    .output(z.object({ to: z.string() }))
    .handler(async ({ input, context }) => {
      const to = context.session.user.email
      const [org] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, context.organizationId))
      const message = {
        to,
        subject: `Test email from ${org?.name ?? "your business"}`,
        text: "This is a test. If you can read it, your email settings work.",
      }

      try {
        if (input.settings) {
          await deliver(
            await draftTransport(context.organizationId, input.settings),
            message
          )
        } else {
          await sendOrganizationEmail(context.organizationId, message)
        }
      } catch (error) {
        deliveryFailed(error)
      }

      return { to }
    }),

  getDomain: ownerProcedure
    .route({ method: "GET", path: "/domain", tags: ["settings"] })
    .output(domainOutput)
    .handler(({ context }) => readDomain(context.organizationId)),

  /** Claims a hostname, pending until `verifyDomain` finds the DNS records. */
  setDomain: ownerProcedure
    .route({ method: "PUT", path: "/domain", tags: ["settings"] })
    .input(z.object({ hostname: z.string().max(300) }))
    .output(domainOutput)
    .handler(async ({ input, context }) => {
      const hostname = normalizeHostname(input.hostname)
      if (!isValidHostname(hostname)) {
        throw invalid("INVALID_HOSTNAME", "That isn't a valid web address.")
      }
      if (
        [...RESERVED_HOSTNAMES].some(
          (reserved) =>
            hostname === reserved || hostname.endsWith(`.${reserved}`)
        )
      ) {
        throw invalid(
          "HOSTNAME_RESERVED",
          "That address belongs to the platform."
        )
      }

      const taken = await db.query.customDomain.findFirst({
        where: and(
          eq(customDomain.hostname, hostname),
          eq(customDomain.status, "active"),
          ne(customDomain.organizationId, context.organizationId)
        ),
        columns: { id: true },
      })
      if (taken) {
        throw new ORPCError("CONFLICT", {
          message: "Another business already uses that address.",
          data: { code: "DOMAIN_TAKEN" },
        })
      }

      const existing = await db.query.customDomain.findFirst({
        where: eq(customDomain.organizationId, context.organizationId),
        columns: { hostname: true },
      })
      if (existing?.hostname !== hostname) {
        const values = {
          hostname,
          verificationToken: `duralex-verify=${randomBytes(16).toString("hex")}`,
          status: "pending" as const,
          verifiedAt: null,
          lastCheckedAt: null,
          lastError: null,
        }
        await db
          .insert(customDomain)
          .values({ ...values, organizationId: context.organizationId })
          .onConflictDoUpdate({
            target: customDomain.organizationId,
            set: values,
          })
        forgetCustomDomains()
      }

      return readDomain(context.organizationId)
    }),

  /**
   * Looks the domain up in DNS. Once it checks out it goes active and the
   * TLS proxy may issue its certificate; an active domain whose records
   * have since gone stays active (removing it is explicit).
   */
  verifyDomain: ownerProcedure
    .route({ method: "POST", path: "/domain/verify", tags: ["settings"] })
    .output(domainOutput)
    .handler(async ({ context }) => {
      const found = await db.query.customDomain.findFirst({
        where: eq(customDomain.organizationId, context.organizationId),
      })
      if (!found) {
        throw new ORPCError("NOT_FOUND", {
          message: "Add a web address first.",
          data: { code: "DOMAIN_NOT_FOUND" },
        })
      }

      const error = await checkDomain(found.hostname, found.verificationToken)
      const now = new Date()
      const mine = eq(customDomain.organizationId, context.organizationId)

      if (error) {
        await db
          .update(customDomain)
          .set({ lastCheckedAt: now, lastError: error })
          .where(mine)
      } else {
        try {
          await db
            .update(customDomain)
            .set({
              status: "active",
              verifiedAt: found.verifiedAt ?? now,
              lastCheckedAt: now,
              lastError: null,
            })
            .where(mine)
        } catch (cause) {
          if (!isUniqueViolation(cause)) throw cause
          await db
            .update(customDomain)
            .set({ lastCheckedAt: now, lastError: "DOMAIN_TAKEN" })
            .where(mine)
        }
        forgetCustomDomains()
      }

      return readDomain(context.organizationId)
    }),

  removeDomain: ownerProcedure
    .route({ method: "DELETE", path: "/domain", tags: ["settings"] })
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context }) => {
      await db
        .delete(customDomain)
        .where(eq(customDomain.organizationId, context.organizationId))
      forgetCustomDomains()
      return { success: true }
    }),
})

/** The form's settings as a transport, borrowing the saved secret if blank. */
async function draftTransport(
  organizationId: string,
  input: EmailSettingsInput
) {
  let secret = input.secret
  if (!secret) {
    const saved = await db.query.emailSettings.findFirst({
      where: eq(emailSettings.organizationId, organizationId),
      columns: { provider: true, secret: true },
    })
    secret =
      saved?.provider === input.provider ? openSecret(saved.secret) : null
  }
  if (!secret) {
    throw new EmailDeliveryError(
      input.provider === "smtp"
        ? "Enter the SMTP password."
        : "Enter the API key."
    )
  }

  return {
    provider: input.provider,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    replyTo: input.replyTo,
    smtpHost: input.provider === "smtp" ? input.smtpHost : null,
    smtpPort: input.provider === "smtp" ? input.smtpPort : null,
    smtpSecure: input.provider === "smtp" ? input.smtpSecure : false,
    smtpUsername: input.provider === "smtp" ? input.smtpUsername : null,
    secret,
  }
}
