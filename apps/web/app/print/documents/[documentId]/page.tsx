import type { Metadata } from "next"

import { PrintDocument } from "@/components/signature/print-document"

export const metadata: Metadata = { robots: { index: false } }

/**
 * What the API's headless Chrome prints a contract sent for signature from
 * (see packages/api/src/lib/signing/signed-pdf.ts). No session: the token in the
 * address, minted by the API for this document, is the permission.
 */
export default async function PrintDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { documentId } = await params
  const { token } = await searchParams

  return <PrintDocument id={documentId} token={token ?? ""} />
}