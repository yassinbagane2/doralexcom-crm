"use client"

import type { UseMutationResult } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/ui/button"
import { Loader2, Paperclip } from "@workspace/ui/icons"
import type { ReactNode } from "react"

import { openFile } from "@/lib/download"

/**
 * Opens a proof of payment in a new tab. Whose file it is decides where it
 * comes from (the business's API or the customer's portal), so the caller
 * hands over the mutation that fetches it. Proofs are PDFs or images only,
 * which the browser shows as they are.
 */
export function ProofFileButton({
  id,
  fetchFile,
  label,
  children,
}: {
  id: string
  fetchFile: UseMutationResult<File, unknown, { id: string }, unknown>
  label: string
  /** Shown beside the icon; icon only when left out. */
  children?: ReactNode
}) {
  const loading = fetchFile.isPending && fetchFile.variables?.id === id
  return (
    <Button
      variant="ghost"
      size={children ? "xs" : "icon-xs"}
      aria-label={label}
      title={label}
      disabled={loading}
      onClick={() => fetchFile.mutate({ id }, { onSuccess: openFile })}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Paperclip className="size-3" />
      )}
      {children}
    </Button>
  )
}
