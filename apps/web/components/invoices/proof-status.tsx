import { invoiceRemaining } from "@workspace/api/invoice"
import { Badge } from "@workspace/ui/components/ui/badge"

/*
 * Where an invoice's proofs of payment stand, as the business's lease card
 * and the customer's invoices both show it.
 */

type WithProofs<T> = Parameters<typeof invoiceRemaining>[0] & { proofs: T[] }

/** The proof waiting for the business on an invoice, if any. */
export function pendingProof<T extends { status: string }>(
  invoice: Pick<WithProofs<T>, "proofs">
) {
  return invoice.proofs.find((proof) => proof.status === "pending")
}

/**
 * The last proof the business turned down, worth showing while nothing newer
 * waits and money is still owed.
 */
export function lastRejectedProof<T extends { status: string }>(
  invoice: WithProofs<T>
) {
  if (pendingProof(invoice) || invoiceRemaining(invoice) === 0) return undefined
  return invoice.proofs.find((proof) => proof.status === "rejected")
}

export function AwaitingProofBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400"
    >
      {label}
    </Badge>
  )
}
