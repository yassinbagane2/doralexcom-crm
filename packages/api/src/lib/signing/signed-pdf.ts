import { db } from "@workspace/db"
import { customerDocument } from "@workspace/db/schema"
import { eq } from "drizzle-orm"

import { env } from "../../env"
import { sha256 } from "../hash"
import { renderPdf } from "../pdf-renderer"
import { contractStorage, signedPdfKey } from "../storage"
import { printToken } from "./print-token"

/*
 * A contract sent for signature is kept as a PDF in R2, one object per
 * contract: written when the business signs it (on sending), and written
 * again, over the same object, when the customer signs. That PDF is what both
 * parties read and download. The web app draws it (pages, signatures, audit
 * trail) on a print page, which the PDF renderer prints.
 */

type SignedDocument = {
  id: string
  organizationId: string
  customerId: string
}

/** Where the print page is served: the web app, as the API can reach it. */
const printOrigin = () => process.env.PDF_RENDER_URL ?? env.NEXT_PUBLIC_APP_URL

/**
 * Prints the contract as it is signed so far and stores it, over the
 * previous version, with its hash on the row.
 */
export async function writeSignedPdf(document: SignedDocument) {
  const url = new URL(`/print/documents/${document.id}`, printOrigin())
  url.searchParams.set("token", printToken(document.id))
  const pdf = await renderPdf(url.toString(), {
    readySelector: "[data-print-ready]",
  })

  await contractStorage.upload({
    key: signedPdfKey(document),
    body: pdf,
    contentType: "application/pdf",
  })
  await db
    .update(customerDocument)
    .set({ signedFileHash: sha256(pdf) })
    .where(eq(customerDocument.id, document.id))
}

/**
 * `writeSignedPdf` for after a signature is recorded: the signature stands
 * even if printing fails, so the failure is logged, not thrown.
 */
export async function tryWriteSignedPdf(document: SignedDocument) {
  try {
    await writeSignedPdf(document)
  } catch (error) {
    console.error(`Could not write the PDF of document ${document.id}`, error)
  }
}

/** The contract's stored PDF, or null when none has been written. */
export function readSignedPdf(document: SignedDocument) {
  return contractStorage.getObjectBytes(signedPdfKey(document))
}

/** Best effort, like every cleanup of R2 once the rows are settled. */
export function discardSignedPdf(document: SignedDocument) {
  return contractStorage.deleteObject(signedPdfKey(document)).catch(() => {})
}
