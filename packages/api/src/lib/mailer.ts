import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"

import { ORPCError } from "@orpc/server"
import { sendEmail as sendPlatformEmail } from "@workspace/auth/email"
import { db } from "@workspace/db"
import { emailSettings } from "@workspace/db/schema"
import { eq } from "drizzle-orm"
import { createTransport } from "nodemailer"

import type { EmailProvider } from "../settings"
import { openSecret } from "./secret-box"

/*
 * Email a business sends (collaborator invitations, test messages) goes out
 * through the service it configured in its settings, or the platform's own
 * when it hasn't set one up.
 */

export interface OutgoingEmail {
  to: string
  subject: string
  text: string
}

/** A business's email service, with its secret decrypted. */
export interface EmailTransport {
  provider: EmailProvider
  fromName: string | null
  fromEmail: string
  replyTo: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUsername: string | null
  secret: string
}

const TIMEOUT_MS = 15_000

/** The provider refused or couldn't be reached; `message` says why. */
export class EmailDeliveryError extends Error {
  override name = "EmailDeliveryError"
}

function fromHeader({ fromName, fromEmail }: EmailTransport) {
  if (!fromName) return fromEmail
  // Quoted, so commas and other specials in the name stay part of it.
  return `"${fromName.replace(/["\\]/g, "")}" <${fromEmail}>`
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown
) {
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new EmailDeliveryError(
      `Couldn't reach the email service: ${(error as Error).message}`
    )
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300)
    throw new EmailDeliveryError(
      `The email service answered ${response.status}${detail ? `: ${detail}` : ""}`
    )
  }
}

/** Loopback, private, link-local and other addresses inside the network. */
const internal = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
] as const) {
  internal.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  internal.addSubnet(network, prefix, "ipv6")
}

/**
 * A business chooses the SMTP host, so in production it must be a public
 * one: otherwise "send a test email" would let anyone probe the servers on
 * the platform's own network. Locally, a mail catcher on localhost is fine.
 */
async function resolvePublicHost(host: string): Promise<string> {
  if (process.env.NODE_ENV !== "production") return host

  let addresses: { address: string; family: number }[]
  try {
    addresses = isIP(host)
      ? [{ address: host, family: isIP(host) }]
      : await lookup(host, { all: true })
  } catch {
    throw new EmailDeliveryError(`Couldn't find the SMTP server ${host}.`)
  }

  const blocked = addresses.some(({ address, family }) => {
    const mapped = family === 6 && address.toLowerCase().startsWith("::ffff:")
    return mapped
      ? internal.check(address.slice(7), "ipv4")
      : internal.check(address, family === 6 ? "ipv6" : "ipv4")
  })
  if (blocked) {
    throw new EmailDeliveryError(
      `${host} is a private address; use your provider's public SMTP server.`
    )
  }
  // Connect to the address just checked, so a second lookup can't swap it.
  return addresses[0]!.address
}

/** Sends one message through `transport`. Throws EmailDeliveryError. */
export async function deliver(transport: EmailTransport, email: OutgoingEmail) {
  const from = fromHeader(transport)

  switch (transport.provider) {
    case "resend":
      return postJson(
        "https://api.resend.com/emails",
        { Authorization: `Bearer ${transport.secret}` },
        {
          from,
          to: email.to,
          subject: email.subject,
          text: email.text,
          ...(transport.replyTo ? { reply_to: transport.replyTo } : {}),
        }
      )

    case "postmark":
      return postJson(
        "https://api.postmarkapp.com/email",
        {
          Accept: "application/json",
          "X-Postmark-Server-Token": transport.secret,
        },
        {
          From: from,
          To: email.to,
          Subject: email.subject,
          TextBody: email.text,
          MessageStream: "outbound",
          ...(transport.replyTo ? { ReplyTo: transport.replyTo } : {}),
        }
      )

    case "smtp": {
      if (!transport.smtpHost) {
        throw new EmailDeliveryError("Enter the SMTP server.")
      }
      const smtp = createTransport({
        host: await resolvePublicHost(transport.smtpHost),
        // Certificates are for the name, not the address connected to.
        tls: { servername: transport.smtpHost },
        port: transport.smtpPort ?? undefined,
        secure: transport.smtpSecure,
        auth: transport.smtpUsername
          ? { user: transport.smtpUsername, pass: transport.secret }
          : undefined,
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
      })
      try {
        await smtp.sendMail({
          from,
          to: email.to,
          subject: email.subject,
          text: email.text,
          replyTo: transport.replyTo ?? undefined,
        })
      } catch (error) {
        // Connection failures (ECONNREFUSED…) can carry an empty message.
        const { message, code } = error as Error & { code?: string }
        throw new EmailDeliveryError(
          `The SMTP server refused the message: ${message || code || "no reason given"}`
        )
      } finally {
        smtp.close()
      }
    }
  }
}

/**
 * The business's configured service, or null to use the platform's. A
 * secret that no longer decrypts (the server's secret was rotated) is an
 * error rather than a silent fallback: the business chose not to send as us.
 */
export async function findEmailTransport(
  organizationId: string
): Promise<EmailTransport | null> {
  const settings = await db.query.emailSettings.findFirst({
    where: eq(emailSettings.organizationId, organizationId),
  })
  if (!settings) return null

  const secret = openSecret(settings.secret)
  if (secret === null) {
    throw new EmailDeliveryError(
      "The saved email password or API key can no longer be read. Enter it again in Settings → Email."
    )
  }

  return { ...settings, secret }
}

/** Sends as the business: through its own service when it has one. */
export async function sendOrganizationEmail(
  organizationId: string,
  email: OutgoingEmail
) {
  const transport = await findEmailTransport(organizationId)
  if (!transport) {
    try {
      await sendPlatformEmail(email)
    } catch (error) {
      throw new EmailDeliveryError((error as Error).message)
    }
    return
  }

  await deliver(transport, email)
}

/** For procedures that report a failed send to the person who asked. */
export function deliveryFailed(error: unknown): never {
  if (error instanceof EmailDeliveryError) {
    throw new ORPCError("BAD_GATEWAY", {
      message: error.message,
      data: { code: "EMAIL_DELIVERY_FAILED", detail: error.message },
    })
  }
  throw error
}
