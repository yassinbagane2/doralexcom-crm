import { env } from "./env"

/** Matches the emailOTP plugin's default `expiresIn`, in seconds. */
export const OTP_EXPIRES_IN = 300

export interface Email {
  to: string
  subject: string
  text: string
}

export async function sendEmail({ to, subject, text }: Email) {
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set; cannot send email.")
    }

    // Lets the whole auth flow run locally without an email provider.
    console.info(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`)
    return
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  })

  if (!response.ok) {
    throw new Error(
      `Resend responded ${response.status}: ${await response.text()}`
    )
  }
}

/**
 * Sends without blocking the request. Awaiting would make the response time
 * depend on whether the address exists, which leaks it to an attacker timing
 * the reset-password endpoint.
 */
function sendEmailInBackground(email: Email) {
  sendEmail(email).catch((error: unknown) => {
    console.error(`[email] Failed to send "${email.subject}":`, error)
  })
}

const OTP_EMAILS = {
  "sign-in": { subject: "Your sign-in code", action: "sign in" },
  "email-verification": {
    subject: "Verify your email",
    action: "verify your email",
  },
  "forget-password": {
    subject: "Reset your password",
    action: "reset your password",
  },
  "change-email": {
    subject: "Confirm your new email",
    action: "confirm your new email",
  },
} as const

export function sendVerificationOTP({
  email,
  otp,
  type,
}: {
  email: string
  otp: string
  type: keyof typeof OTP_EMAILS
}) {
  const { subject, action } = OTP_EMAILS[type]
  const minutes = OTP_EXPIRES_IN / 60

  sendEmailInBackground({
    to: email,
    subject,
    text: [
      `Use this code to ${action}: ${otp}`,
      `It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.`,
    ].join("\n\n"),
  })
}

/**
 * Tells the business's owners that someone answered their invitation. From
 * the platform's address, like the other account emails: it is about the
 * owner's account, not something the business sends.
 */
export function sendInvitationResponse({
  to,
  ownerName,
  inviteeEmail,
  organizationName,
  accepted,
}: {
  to: string
  ownerName: string
  inviteeEmail: string
  organizationName: string
  accepted: boolean
}) {
  sendEmailInBackground({
    to,
    subject: accepted
      ? `${inviteeEmail} joined ${organizationName}`
      : `${inviteeEmail} declined your invitation`,
    text: [
      `Hi ${ownerName},`,
      accepted
        ? `${inviteeEmail} accepted your invitation and now works with you on ${organizationName}.`
        : `${inviteeEmail} declined your invitation to ${organizationName}. You can invite them again from Settings → Collaborators.`,
    ].join("\n\n"),
  })
}
