"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  DOCUMENT_FILE_TYPES,
  DOCUMENT_LIMITS,
  isDocumentFileType,
} from "@workspace/api/contract"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select"
import {
  createFileUploadItem,
  FileUpload,
  type FileUploadItem,
} from "@workspace/ui/components/motion/file-upload"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Eye, FileText, Loader2, Trash } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  fillContract,
  useMergeValues,
} from "@/components/contracts/contract-content"
import { DocumentViewer } from "@/components/customers/document-viewer"
import { Section } from "@/components/customers/section"
import { routes } from "@/config/routes"
import {
  useContractTemplates,
  useCreateContractDocument,
  useDeleteDocument,
  useCustomerDocuments,
  useUploadDocument,
  type CustomerDocument,
} from "@/hooks/queries/contract"
import type { CustomerDetail, CustomerLease } from "@/hooks/queries/customer"
import { fileKind, FileTypeIcon } from "@/lib/file-icon"
import { formatDate } from "@/lib/format"
import { orpc } from "@/lib/orpc"

/** "1.2 MB", "340 KB". */
function formatSize(bytes: number, locale: string) {
  const format = (value: number, unit: string) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`
  if (bytes >= 1024 * 1024) return format(bytes / (1024 * 1024), "MB")
  return format(Math.max(1, bytes / 1024), "KB")
}

/** The type a file reads as: "PDF", "DOCX", "JPG". */
function extensionLabel(document: CustomerDocument) {
  if (document.mimeType && isDocumentFileType(document.mimeType)) {
    return DOCUMENT_FILE_TYPES[document.mimeType].toUpperCase()
  }
  return document.name.split(".").pop()?.toUpperCase() ?? null
}

/** Kind, lease, size and date: the line under a document's name. */
function useDocumentMeta(customer: CustomerDetail) {
  const t = useTranslations("Documents")
  const locale = useLocale()
  return (document: CustomerDocument) => {
    const lease = customer.leases.find((l) => l.id === document.leaseId)
    return [
      document.kind === "contract" ? t("contract") : extensionLabel(document),
      lease ? t("lease", { property: lease.property.name }) : null,
      document.size !== null ? formatSize(document.size, locale) : null,
      formatDate(document.createdAt, locale),
    ]
      .filter(Boolean)
      .join(" · ")
  }
}

/**
 * Everything kept about a customer: files uploaded as they are (a signed lease,
 * an ID) and contracts generated from a template. Any of them opens straight
 * into a viewer on the page; contracts can go on to the editor from there.
 */
export function CustomerDocuments({ customer }: { customer: CustomerDetail }) {
  const t = useTranslations("Documents")
  const { data: documents, isPending } = useCustomerDocuments(customer.id)
  // The dialog is open while this is set; files dropped on the page come along.
  const [uploading, setUploading] = useState<File[] | null>(null)
  const [deleting, setDeleting] = useState<CustomerDocument | null>(null)
  const [viewing, setViewing] = useState<CustomerDocument | null>(null)
  const meta = useDocumentMeta(customer)
  const contractHref = (document: CustomerDocument) =>
    `${routes.customers}/${customer.id}/contracts/${document.id}`

  return (
    <Section
      title={t("title")}
      count={documents?.length}
    >
      <FileUpload
        value={NO_ITEMS}
        accept={ACCEPTED_FILES}
        title={t("dropTitle")}
        description={t("uploadDescription")}
        browseLabel={t("browse")}
        onFilesAdded={(_, files) => setUploading(files)}
        classNames={{
          root: "space-y-0",
          dropzone:
            "rounded-xl border-transparent bg-muted/40 p-4 hover:border-transparent hover:bg-muted/60 active:scale-100 data-[dragging=true]:border-foreground/30 data-[dragging=true]:bg-muted/60",
        }}
      />
      {isPending ? (
        <div className="flex flex-col gap-1">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 py-2.5">
              <div className="size-8 animate-pulse rounded-md bg-muted" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : documents && documents.length > 0 ? (
        <ul className="-mx-2 flex flex-col">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              meta={meta(document)}
              onView={() => setViewing(document)}
              onDelete={() => setDeleting(document)}
            />
          ))}
        </ul>
      ) : null}

      <DocumentViewer
        document={viewing}
        meta={viewing ? meta(viewing) : ""}
        editHref={viewing?.kind === "contract" ? contractHref(viewing) : null}
        onClose={() => setViewing(null)}
      />
      <UploadDocumentDialog
        customer={customer}
        files={uploading ?? undefined}
        open={uploading !== null}
        onOpenChange={(open) => !open && setUploading(null)}
      />
      <DeleteDocumentDialog
        document={deleting}
        onClose={() => setDeleting(null)}
      />
    </Section>
  )
}

function DocumentRow({
  document,
  meta,
  onView,
  onDelete,
}: {
  document: CustomerDocument
  meta: string
  onView: () => void
  onDelete: () => void
}) {
  const t = useTranslations("Documents")

  return (
    <li className="group flex items-center gap-2 rounded-lg pr-1 transition-colors hover:bg-muted/50">
      <button
        type="button"
        onClick={onView}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pl-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <FileTypeIcon
          kind={
            document.kind === "contract" ? "word" : fileKind(document.mimeType)
          }
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{document.name}</span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        </span>
      </button>

      {/* Revealed on hover or keyboard focus; always there on touch screens. */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onView}
        >
          <Eye size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("deleteLabel", { name: document.name })}
          onClick={onDelete}
        >
          <Trash size={16} />
        </Button>
      </div>
    </li>
  )
}

const ACCEPTED_FILES = Object.keys(DOCUMENT_FILE_TYPES)
  .concat(Object.values(DOCUMENT_FILE_TYPES).map((ext) => `.${ext}`))
  .join(",")

const NO_LEASE = "none"
const NO_ITEMS: FileUploadItem[] = []

/** How far the bar creeps while a file is in flight; the request has no progress events. */
const PROGRESS_CEILING = 90

/**
 * Attaches files to the customer, optionally to one of their leases. Files are
 * checked as they're added and sent together on submit, each with its own row.
 */
export function UploadDocumentDialog({
  customer,
  leaseId,
  files,
  open,
  onOpenChange,
}: {
  customer: CustomerDetail
  /** The lease to attach them to, preselected. */
  leaseId?: string
  /** Files already picked, e.g. dropped on the page. */
  files?: File[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Documents")
  const tc = useTranslations("Common")
  const upload = useUploadDocument()
  const [items, setItems] = useState<FileUploadItem[]>(NO_ITEMS)
  const [error, setError] = useState<string | null>(null)
  const [lease, setLease] = useState(leaseId ?? NO_LEASE)
  const [sending, setSending] = useState(false)

  const stage = (file: File, index: number): FileUploadItem => {
    const problem = !isDocumentFileType(file.type)
      ? t("wrongType")
      : file.size === 0 || file.size > DOCUMENT_LIMITS.fileBytes
        ? t("tooLarge")
        : undefined
    return {
      ...createFileUploadItem(file, index),
      status: problem ? "error" : "queued",
      error: problem,
    }
  }

  // Files handed over from the page are staged as the dialog opens.
  const [handed, setHanded] = useState<File[] | undefined>(undefined)
  if (files !== handed) {
    setHanded(files)
    if (files && files.length > 0) setItems(files.map(stage))
  }

  const patch = (id: string, change: Partial<FileUploadItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item))
    )

  // Ease each bar towards the ceiling until its request settles.
  const inFlight = items.some((item) => item.status === "uploading")
  useEffect(() => {
    if (!inFlight) return
    const timer = window.setInterval(() => {
      setItems((current) =>
        current.map((item) => {
          if (item.status !== "uploading") return item
          const progress = item.progress ?? 0
          return {
            ...item,
            progress: progress + (PROGRESS_CEILING - progress) * 0.08,
          }
        })
      )
    }, 120)
    return () => window.clearInterval(timer)
  }, [inFlight])

  const reset = () => {
    setItems(NO_ITEMS)
    setError(null)
    setLease(leaseId ?? NO_LEASE)
  }

  const close = () => {
    onOpenChange(false)
    reset()
  }

  const send = async (item: FileUploadItem) => {
    if (!item.file) return false
    patch(item.id, { status: "uploading", progress: 0, error: undefined })
    try {
      await upload.mutateAsync({
        customerId: customer.id,
        leaseId: lease === NO_LEASE ? null : lease,
        file: item.file,
      })
      patch(item.id, { status: "success", progress: 100 })
      return true
    } catch {
      patch(item.id, { status: "error", error: t("uploadFailed") })
      return false
    }
  }

  const submit = async () => {
    const queued = items.filter((item) => item.status === "queued")
    if (queued.length === 0) {
      if (items.length === 0) setError(t("chooseFile"))
      return
    }
    setSending(true)
    const results = await Promise.all(queued.map(send))
    setSending(false)

    const sent = results.filter(Boolean).length
    if (sent > 0) toast.success(t("uploaded", { count: sent }))
    // Anything that didn't make it stays listed so it can be retried or removed.
    const rejected = items.some((item) => item.status === "error")
    if (sent === queued.length && !rejected) close()
  }

  const leaseItems = [
    { value: NO_LEASE, label: t("noLease") },
    ...customer.leases.map((l) => ({ value: l.id, label: l.property.name })),
  ]
  const queuedCount = items.filter((item) => item.status === "queued").length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true)
        else if (!sending) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("uploadTitle")}</DialogTitle>
          <DialogDescription>{t("uploadDescription")}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {customer.leases.length > 0 ? (
            <Field>
              <Label htmlFor="document-lease">{t("leaseField")}</Label>
              <Select
                items={leaseItems}
                value={lease}
                disabled={sending}
                onValueChange={(value) => value && setLease(value)}
              >
                <SelectTrigger id="document-lease">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leaseItems.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field>
            <FileUpload
              value={items}
              accept={ACCEPTED_FILES}
              disabled={sending}
              title={t("dropTitle")}
              description={t("dropDescription")}
              browseLabel={t("browse")}
              // Adding and retrying are handled below; only removals come through here.
              onValueChange={(next) =>
                setItems((current) =>
                  current.filter((item) =>
                    next.some((entry) => entry.id === item.id)
                  )
                )
              }
              onFilesAdded={(_, added) => {
                setError(null)
                setItems((current) => [...current, ...added.map(stage)])
              }}
              onRetry={(item) => {
                const restaged = item.file ? stage(item.file, 0) : null
                if (restaged?.status === "error") {
                  patch(item.id, { status: "error", error: restaged.error })
                } else {
                  void send(item)
                }
              }}
              classNames={{
                dropzone: "rounded-xl p-4 hover:bg-muted/30 active:scale-100",
                queue: "max-h-72 space-y-1.5 overflow-y-auto",
                item: "rounded-lg border-transparent bg-muted/40 p-2.5",
                leading: "h-9 w-9 rounded-md bg-background",
              }}
            />
            <FieldError>{error}</FieldError>
          </Field>

          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={close}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : null}
              {queuedCount > 1
                ? t("uploadSubmitCount", { count: queuedCount })
                : t("uploadSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDocumentDialog({
  document,
  onClose,
}: {
  document: CustomerDocument | null
  onClose: () => void
}) {
  const t = useTranslations("Documents")
  const tc = useTranslations("Common")
  const remove = useDeleteDocument()
  // Kept while the dialog animates closed.
  const [shown, setShown] = useState(document)
  if (document && document !== shown) setShown(document)

  return (
    <Dialog
      open={document !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("deleteTitle", { name: shown?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("deleteDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending || !document}
            onClick={() =>
              document &&
              remove.mutate({ id: document.id }, { onSuccess: onClose })
            }
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("deleteSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Fills a contract template in with one lease's details and saves the result
 * on the customer, then opens it in the editor.
 */
export function GenerateContractDialog({
  customer,
  lease,
  open,
  onOpenChange,
}: {
  customer: CustomerDetail
  lease: CustomerLease
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Documents")
  const tc = useTranslations("Common")
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: templates } = useContractTemplates()
  const create = useCreateContractDocument()
  const mergeValues = useMergeValues()
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [working, setWorking] = useState(false)

  const items = (templates ?? []).map((template) => ({
    value: template.id,
    label: template.name,
  }))
  const pending = working || create.isPending

  const pick = (id: string) => {
    setTemplateId(id)
    const template = templates?.find((candidate) => candidate.id === id)
    if (template) {
      setName(
        t("contractName", { template: template.name, customer: customer.name })
      )
    }
  }

  const generate = async () => {
    if (!templateId) return
    setWorking(true)
    try {
      const [template, data] = await Promise.all([
        queryClient.fetchQuery(
          orpc.contract.getTemplate.queryOptions({ input: { id: templateId } })
        ),
        queryClient.fetchQuery(
          orpc.contract.mergeData.queryOptions({
            input: { leaseId: lease.id },
            // Always the lease as it is now.
            staleTime: 0,
          })
        ),
      ])
      const { id } = await create.mutateAsync({
        customerId: customer.id,
        leaseId: lease.id,
        name: (name.trim() || template.name).slice(0, 200),
        content: fillContract(template.content, mergeValues(data)),
      })
      toast.success(t("generated"))
      onOpenChange(false)
      router.push(`${routes.customers}/${customer.id}/contracts/${id}`)
    } catch {
      // The request's own error toast says what went wrong.
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setTemplateId(null)
          setName("")
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>
            {t("generateDescription", { property: lease.property.name })}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void generate()
          }}
        >
          <Field>
            <Label htmlFor="contract-template">{t("template")}</Label>
            <Select
              items={items}
              value={templateId}
              onValueChange={(value) => value && pick(value)}
            >
              <SelectTrigger id="contract-template">
                <SelectValue placeholder={t("templatePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {items.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    <FileText className="text-muted-foreground" />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates && templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t.rich("noTemplates", {
                  link: (chunks) => (
                    <Link
                      href={`${routes.templates}/new`}
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            ) : null}
          </Field>
          <Field>
            <Label htmlFor="contract-name">{t("name")}</Label>
            <Input
              id="contract-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!templateId || pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {t("generateSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
