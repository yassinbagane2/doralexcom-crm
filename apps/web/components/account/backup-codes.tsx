"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { toast } from "@workspace/ui/components/ui/sonner"
import { Check, Download } from "@workspace/ui/icons"
import { useState } from "react"

/** Shown once, right after the codes are generated; the server keeps hashes. */
export function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      setCopied(true)
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them manually.")
    }
  }

  function download() {
    const file = new Blob([`${codes.join("\n")}\n`], { type: "text/plain" })
    const url = URL.createObjectURL(file)
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: "backup-codes.txt",
    })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border bg-muted/50 p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check /> : null}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={download}>
          <Download size={16} />
          Download
        </Button>
      </div>
    </div>
  )
}
