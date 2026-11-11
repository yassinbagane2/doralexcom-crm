"use client"

import { useQuery } from "@tanstack/react-query"
import {
  isDocumentFileType,
  PREVIEWABLE_FILE_TYPES,
} from "@workspace/api/contract"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import {
  AlertCircle,
  Download,
  FilePen,
  LoaderCircle,
  X,
} from "@workspace/ui/icons"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { ContractPages } from "@/components/contracts/contract-pages"
import {
  useContractDocument,
  type CustomerDocument,
} from "@/hooks/queries/contract"
import { saveFile } from "@/lib/download"
import { fileKind, FileTypeIcon } from "@/lib/file-icon"
import { orpc } from "@/lib/orpc"

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/**
 * Shows a customer's document right in the page: contracts as their pages,
 * PDFs in the browser's own viewer, photos, text and .docx files rendered in
 * place. Anything else (old .doc, .odt) offers a download instead.
 */
export function DocumentViewer({
  document,
  meta,
  editHref,
  onClose,
}: {
  document: CustomerDocument | null
  /** The line under the title: kind, lease, size, date. */
  meta: string
  /** Where a contract opens for editing. */
  editHref: string | null
  onClose: () => void
}) {
  const t = useTranslations("Documents")
  // Kept while the dialog animates closed.
  const [shown, setShown] = useState(document)
  if (document && document !== shown) setShown(document)

  const isContract = shown?.kind === "contract"
  const file = useQuery({
    ...orpc.document.download.queryOptions({ input: { id: shown?.id ?? "" } }),
    enabled: Boolean(shown && !isContract),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60_000,
  })

  return (
    <Dialog
      open={document !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {shown ? (
          <>
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <FileTypeIcon
                kind={isContract ? "word" : fileKind(shown.mimeType)}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <DialogTitle className="truncate text-sm font-medium">
                  {shown.name}
                </DialogTitle>
                <DialogDescription className="truncate text-xs">
                  {meta}
                </DialogDescription>
              </div>
              {isContract && editHref ? (
                <Button size="sm" render={<Link href={editHref} />}>
                  <FilePen className="size-3.5" />
                  {t("edit")}
                </Button>
              ) : null}
              {!isContract ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!file.data}
                  onClick={() => file.data && saveFile(file.data, shown.name)}
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">{t("download")}</span>
                </Button>
              ) : null}
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-muted-foreground"
                    aria-label={t("close")}
                  />
                }
              >
                <X className="size-4" />
              </DialogClose>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-muted/50">
              {isContract ? (
                <ContractBody id={shown.id} />
              ) : file.isPending ? (
                <Loading />
              ) : file.isError || !file.data ? (
                <Message icon={<AlertCircle className="size-5" />}>
                  {t("previewFailed")}
                </Message>
              ) : (
                <FileBody
                  file={file.data}
                  mimeType={shown.mimeType}
                  name={shown.name}
                />
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ContractBody({ id }: { id: string }) {
  const t = useTranslations("Documents")
  const contract = useContractDocument(id)

  if (contract.isPending) return <Loading />
  if (contract.isError || !contract.data) {
    return (
      <Message icon={<AlertCircle className="size-5" />}>
        {t("previewFailed")}
      </Message>
    )
  }
  return <ContractPages content={contract.data.content} />
}

function FileBody({
  file,
  mimeType,
  name,
}: {
  file: Blob
  mimeType: string | null
  name: string
}) {
  const t = useTranslations("Documents")
  // Only types the browser shows as themselves (PDFs, photos) get a URL of
  // their own: anything else from our origin could run as a page.
  const previewable =
    mimeType !== null &&
    isDocumentFileType(mimeType) &&
    PREVIEWABLE_FILE_TYPES.includes(mimeType)
  const url = useObjectUrl(previewable ? file : null, mimeType)

  if (previewable && url) {
    if (mimeType === "application/pdf") {
      return <iframe src={url} title={name} className="size-full bg-white" />
    }
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        {/* oxlint-disable-next-line nextjs/no-img-element -- a local blob, nothing to optimize */}
        <img
          src={url}
          alt={name}
          className="max-h-full max-w-full rounded-md object-contain shadow-md"
        />
      </div>
    )
  }
  if (mimeType === DOCX) return <DocxBody file={file} />
  if (mimeType === "text/plain") return <TextBody file={file} />

  return (
    <Message icon={<FileTypeIcon kind={fileKind(mimeType)} />}>
      <span className="font-medium text-foreground">
        {t("previewUnavailable")}
      </span>
      <span>{t("previewUnavailableHint")}</span>
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => saveFile(file, name)}
      >
        <Download className="size-3.5" />
        {t("download")}
      </Button>
    </Message>
  )
}

/** A URL for `blob` typed as `type`, revoked once no longer shown. */
function useObjectUrl(blob: Blob | null, type: string | null) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob || !type) return
    const next = URL.createObjectURL(new Blob([blob], { type }))
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
      setUrl(null)
    }
  }, [blob, type])

  return url
}

/** A .docx drawn page by page in the browser, links kept to the web only. */
function DocxBody({ file }: { file: Blob }) {
  const t = useTranslations("Documents")
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const container = ref.current
    if (!container) return
    let cancelled = false
    setState("loading")

    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview")
        if (cancelled) return
        await renderAsync(file, container, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          // Embedded HTML could run as part of the page: leave it out.
          renderAltChunks: false,
        })
        if (cancelled) return
        for (const link of container.querySelectorAll("a[href]")) {
          const href = link.getAttribute("href") ?? ""
          if (/^(https?:|mailto:)/i.test(href)) {
            link.setAttribute("target", "_blank")
            link.setAttribute("rel", "noopener noreferrer")
          } else if (!href.startsWith("#")) {
            link.removeAttribute("href")
          }
        }
        setState("ready")
      } catch {
        if (!cancelled) setState("failed")
      }
    })()

    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [file])

  return (
    <>
      {state === "loading" ? <Loading /> : null}
      {state === "failed" ? (
        <Message icon={<AlertCircle className="size-5" />}>
          {t("previewFailed")}
        </Message>
      ) : null}
      <div
        ref={ref}
        className="docx-viewer [&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:px-4! [&_.docx-wrapper]:py-6! [&_.docx-wrapper>section.docx]:mb-6! [&_.docx-wrapper>section.docx]:shadow-md!"
        hidden={state !== "ready"}
      />
    </>
  )
}

function TextBody({ file }: { file: Blob }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void file.text().then((value) => !cancelled && setText(value))
    return () => {
      cancelled = true
    }
  }, [file])

  if (text === null) return <Loading />
  return (
    <div className="flex justify-center px-4 py-6">
      <pre className="w-full max-w-3xl rounded-sm bg-background p-8 font-mono text-sm whitespace-pre-wrap shadow-md ring-1 ring-black/5">
        {text}
      </pre>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function Message({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <span className="mb-1">{icon}</span>
      {children}
    </div>
  )
}
