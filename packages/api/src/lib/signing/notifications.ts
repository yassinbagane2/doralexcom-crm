import { db } from "@workspace/db"
import { customerDocument, organization, user } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

import { inBackground } from "../background"
import { ownerEmails } from "../landlord"
import { appLink } from "../links"
import { sendOrganizationEmail } from "../mailer"

/*
 * Emails a signing sends. They go out in the background: a signature stands
 * whether or not its email could be sent.
 */

type NotifiedDocument = {
  id: string
  organizationId: string
  customerId: string
  name: string
}

/** Asks the customer to sign a contract the business has signed. */
export function notifySignatureRequested(document: NotifiedDocument) {
  inBackground(
    sendSignatureRequest(document),
    `email signature request ${document.id}`
  )
}

/** Lets the business's owners know their customer has signed. */
export function notifySigned(document: NotifiedDocument, signerName: string) {
  inBackground(
    sendSignedNotice(document, signerName),
    `email signed document ${document.id}`
  )
}

async function sendSignatureRequest(document: NotifiedDocument) {
  const [found] = await db
    .select({
      customer: { name: user.name, email: user.email },
      business: { name: organization.name },
    })
    .from(customerDocument)
    .innerJoin(user, eq(user.id, customerDocument.customerId))
    .innerJoin(
      organization,
      eq(organization.id, customerDocument.organizationId)
    )
    .where(eq(customerDocument.id, document.id))
  if (!found) return

  const link = await appLink(
    document.organizationId,
    `/my-home/documents/${document.id}`
  )
  await sendOrganizationEmail(document.organizationId, {
    to: found.customer.email,
    subject: `${found.business.name} sent you "${document.name}" to sign`,
    text: [
      `Hi ${found.customer.name},`,
      `${found.business.name} has signed "${document.name}" and is waiting for your signature.`,
      `Read and sign it here:\n${link}`,
    ].join("\n\n"),
  })
}

async function sendSignedNotice(
  document: NotifiedDocument,
  signerName: string
) {
  const owners = await ownerEmails(document.organizationId)
  const link = await appLink(
    document.organizationId,
    `/customers/${document.customerId}`
  )
  for (const to of owners) {
    await sendOrganizationEmail(document.organizationId, {
      to,
      subject: `${signerName} signed "${document.name}"`,
      text: [
        `${signerName} has signed "${document.name}". The contract is now complete, signed by both parties.`,
        `The signed PDF, with its audit trail, is on the customer's page:\n${link}`,
      ].join("\n\n"),
    })
  }
}
