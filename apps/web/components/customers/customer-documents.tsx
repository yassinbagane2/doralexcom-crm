"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  DOCUMENT_FILE_TYPES,
  DOCUMENT_LIMITS,
  isDocumentFileType,
  PREVIEWABLE_FILE_TYPES,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
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
import { toast } from "@workspace/ui/components/motion/toaster"
import {
  DotsHorizontal,
  Download,
  ExternalLink,
  FilePen,
  FileText,
  Loader2,
  Paperclip,
  PdfDocument,
  Trash,
  Upload,
  WordDocument,
} from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useRef, useState } from "react"

import {
  fillContract,
  useMergeValues,
} from "@/components/contracts/contract-content"
import { routes } from "@/config/routes"
import {
  useContractTemplates,
  useCreateContractDocument,
  useDeleteDocument,
  useDownloadDocument,
  useCustomerDocuments,
  useUploadDocument,
  type CustomerDocument,
} from "@/hooks/queries/contract"
import type { CustomerDetail, CustomerLease } from "@/hooks/queries/customer"
import { openFile, saveFile } from "@/lib/download"
import { formatDate } from "@/lib/format"
import { orpc } from "@/lib/orpc"

/** "1.2 MB", "340 KB". */
function formatSize(bytes: number, locale: string) {
  const format = (value: number, unit: string) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`
  if (bytes >= 1024 * 1024) return format(bytes / (1024 * 1024), "MB")
  return format(Math.max(1, bytes / 1024), "KB")
}

function DocumentIcon({ document }: { document: CustomerDocument }) {
  if (document.kind === "contract") return <FilePen className="size-4" />
  if (document.mimeType === "application/pdf")
    return <PdfDocument className="size-4" />
  if (document.mimeType?.includes("word")) {
    return <WordDocument className="size-4" />
  }
  return <FileText className="size-4" />
}

/**
 * Everything kept about a customer: files uploaded as they are (a signed lease,
 * an ID) and contracts generated from a template, which open in the editor.
 */
export function CustomerDocuments({ customer }: { customer: CustomerDetail }) {
  const t = useTranslations("Documents")
  const { data: documents, isPending } = useCustomerDocuments(customer.id)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<CustomerDocument | null>(null)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t("title")}</h2>
        <Button size="sm" variant="outline" onClick={() => setUploading(true)}>
          <Upload className="size-3.5" />
          {t("upload")}
        </Button>
      </div>

      {isPending ? (
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      ) : !documents || documents.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              customer={customer}
              document={document}
              onDelete={() => setDeleting(document)}
            />
          ))}
        </ul>
      )}

      <UploadDocumentDialog
        customer={customer}
        open={uploading}
        onOpenChange={setUploading}
      />
      <DeleteDocumentDialog
        document={deleting}
        onClose={() => setDeleting(null)}
      />
    </section>
  )
}

function DocumentRow({
  customer,
  document,
  onDelete,
}: {
  customer: CustomerDetail
  document: CustomerDocument
  onDelete: () => void
}) {
  const t = useTranslations("Documents")
  const locale = useLocale()
  const download = useDownloadDocument()
  const lease = customer.leases.find((l) => l.id === document.leaseId)
  const contractHref = `${routes.customers}/${customer.id}/contracts/${document.id}`
  const previewable =
    document.mimeType !== null &&
    isDocumentFileType(document.mimeType) &&
    PREVIEWABLE_FILE_TYPES.includes(document.mimeType)

  const fetchFile = (then: (file: File) => void) =>
    download.mutate({ id: document.id }, { onSuccess: then })

  const meta = [
    document.kind === "contract" ? t("contract") : null,
    lease ? t("lease", { property: lease.property.name }) : null,
    document.size !== null ? formatSize(document.size, locale) : null,
    formatDate(document.createdAt, locale),
  ].filter(Boolean)

  const icon = (
    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
      {download.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <DocumentIcon document={document} />
      )}
    </span>
  )
  const label = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium">{document.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {meta.join(" · ")}
      </span>
    </span>
  )
  const rowClass =
    "flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {document.kind === "contract" ? (
        <Link href={contractHref} className={rowClass}>
          {icon}
          {label}
        </Link>
      ) : (
        <button
          type="button"
          className={rowClass}
          disabled={download.isPending}
          onClick={() =>
            fetchFile((file) =>
              previewable ? openFile(file) : saveFile(file, document.name)
            )
          }
        >
          {icon}
          {label}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("actionsLabel", { name: document.name })}
            />
          }
        >
          <DotsHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {document.kind === "contract" ? (
            <DropdownMenuItem render={<Link href={contractHref} />}>
              <FilePen className="size-4" />
              {t("open")}
            </DropdownMenuItem>
          ) : (
            <>
              {previewable ? (
                <DropdownMenuItem onClick={() => fetchFile(openFile)}>
                  <ExternalLink className="size-4" />
                  {t("open")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() =>
                  fetchFile((file) => saveFile(file, document.name))
                }
              >
                <Download className="size-4" />
                {t("download")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash size={16} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

const ACCEPTED_FILES = Object.keys(DOCUMENT_FILE_TYPES)
  .concat(Object.values(DOCUMENT_FILE_TYPES).map((ext) => `.${ext}`))
  .join(",")

const NO_LEASE = "none"

/** Attaches a file to the customer, optionally to one of their leases. */
export function UploadDocumentDialog({
  customer,
  leaseId,
  open,
  onOpenChange,
}: {
  customer: CustomerDetail
  /** The lease to attach it to, preselected. */
  leaseId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Documents")
  const tc = useTranslations("Common")
  const upload = useUploadDocument()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lease, setLease] = useState(leaseId ?? NO_LEASE)

  const reset = () => {
    setFile(null)
    setError(null)
    setLease(leaseId ?? NO_LEASE)
    upload.reset()
  }

  const leaseItems = [
    { value: NO_LEASE, label: t("noLease") },
    ...customer.leases.map((l) => ({ value: l.id, label: l.property.name })),
  ]

  const choose = (picked: File | undefined) => {
    if (!picked) return
    if (!isDocumentFileType(picked.type)) {
      setFile(null)
      setError(t("wrongType"))
    } else if (picked.size === 0 || picked.size > DOCUMENT_LIMITS.fileBytes) {
      setFile(null)
      setError(t("tooLarge"))
    } else {
      setFile(picked)
      setError(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
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
            if (!file) {
              setError(error ?? t("chooseFile"))
              return
            }
            upload.mutate(
              {
                customerId: customer.id,
                leaseId: lease === NO_LEASE ? null : lease,
                file,
              },
              {
                onSuccess: () => {
                  onOpenChange(false)
                  reset()
                },
              }
            )
          }}
        >
          <Field>
            <Label htmlFor="document-file">{t("file")}</Label>
            <input
              ref={inputRef}
              id="document-file"
              type="file"
              accept={ACCEPTED_FILES}
              className="sr-only"
              onChange={(event) => {
                choose(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-invalid={Boolean(error)}
              className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left text-sm transition-colors hover:bg-muted/60 aria-invalid:border-destructive"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Paperclip className="size-4" />
              </span>
              {file ? (
                <>
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("changeFile")}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{t("chooseFile")}</span>
              )}
            </button>
            <FieldError>{error}</FieldError>
          </Field>

          {customer.leases.length > 0 ? (
            <Field>
              <Label htmlFor="document-lease">{t("leaseField")}</Label>
              <Select
                items={leaseItems}
                value={lease}
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

          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("uploadSubmit")}
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
