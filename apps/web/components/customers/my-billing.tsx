"use client"

import {
  invoiceRemaining,
  invoiceStatus,
  type InvoiceLineKind,
} from "@workspace/api/invoice"
import { localToday } from "@workspace/api/lease"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import {
  ChevronRightIcon,
  FileText,
  Loader2,
  Receipt,
  Signature,
  Upload,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { InvoiceStatusBadge } from "@/components/customers/lease-invoices"
import { PaymentForm } from "@/components/invoices/payment-form"
import { ProofFileButton } from "@/components/invoices/proof-file-button"
import {
  AwaitingProofBadge,
  lastRejectedProof,
  pendingProof,
} from "@/components/invoices/proof-status"
import { SignatureStatusBadge } from "@/components/signature/signing-panel"
import { myDocumentRoute, myReceiptRoute } from "@/config/routes"
import {
  useCancelPaymentProof,
  usePortalDocuments,
  usePortalInvoices,
  usePortalProofFile,
  useSubmitPaymentProof,
  type PortalInvoice,
} from "@/hooks/queries/portal"
import { formatDate, formatMoney } from "@/lib/format"

const TABS = ["pending", "past"] as const
type Tab = (typeof TABS)[number]

/**
 * The customer's invoices: what's still to pay (oldest first, overdue ones
 * flagged), and past ones with a receipt for every payment made.
 */
export function MyInvoices() {
  const t = useTranslations("MyHome.invoices")
  const { data: invoices, isPending } = usePortalInvoices()
  const [tab, setTab] = useState<Tab>("pending")
  const today = localToday()

  if (isPending) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />
  }
  if (!invoices || invoices.length === 0) return null

  const pending = invoices
    .filter((invoice) => invoiceRemaining(invoice) > 0)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const past = invoices.filter((invoice) => invoiceRemaining(invoice) === 0)
  const shown = tab === "pending" ? pending : past

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("title")}</h2>
        <div
          role="tablist"
          aria-label={t("title")}
          className="inline-flex rounded-lg bg-muted p-0.5"
        >
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors",
                tab === value && "bg-background text-foreground shadow-xs"
              )}
            >
              {t(`tabs.${value}`, {
                count: value === "pending" ? pending.length : past.length,
              })}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
          {tab === "pending" ? t("nothingDue") : t("noPast")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((invoice) => (
            <MyInvoice key={invoice.id} invoice={invoice} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}

function MyInvoice({
  invoice,
  today,
}: {
  invoice: PortalInvoice
  today: string
}) {
  const t = useTranslations("MyHome.invoices")
  const tl = useTranslations("Invoices.lines")
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const status = invoiceStatus(invoice, today)
  const remaining = invoiceRemaining(invoice)
  const waiting = pendingProof(invoice)
  const rejected = lastRejectedProof(invoice)
  const money = (amount: number) =>
    formatMoney(amount, invoice.currency, locale)

  return (
    <li className="flex flex-col rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {t("number", { number: invoice.number })}
            {waiting ? (
              <AwaitingProofBadge label={t("proof.awaiting")} />
            ) : (
              <InvoiceStatusBadge status={status} />
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {invoice.property.name} ·{" "}
            {t("period", {
              start: formatDate(invoice.periodStart, locale),
              end: formatDate(invoice.periodEnd, locale),
            })}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-sm font-medium tabular-nums">
            {money(remaining > 0 ? remaining : invoice.total)}
          </span>
          <span
            className={cn(
              "text-xs text-muted-foreground",
              status === "overdue" && "text-destructive"
            )}
          >
            {remaining > 0
              ? t("dueOn", { date: formatDate(invoice.dueOn, locale) })
              : t("issuedOn", { date: formatDate(invoice.issuedOn, locale) })}
          </span>
        </span>
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
            {invoice.lines.map((line) => (
              <LineRow
                key={line.kind}
                label={tl(line.kind as InvoiceLineKind)}
                amount={money(line.amount)}
              />
            ))}
            <dt className="mt-1 border-t pt-1.5 font-medium">{t("total")}</dt>
            <dd className="mt-1 border-t pt-1.5 text-right font-medium tabular-nums">
              {money(invoice.total)}
            </dd>
          </dl>

          {invoice.payments.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">
                {t("payments")}
              </h3>
              <ul className="flex flex-col">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center gap-3 py-1 text-sm"
                  >
                    <span className="text-muted-foreground tabular-nums">
                      {formatDate(payment.paidOn, locale)}
                    </span>
                    <span className="flex-1 tabular-nums">
                      {money(payment.amount)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={myReceiptRoute(payment.id)} />}
                    >
                      <Receipt className="size-3.5" />
                      {t("receipt")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {remaining > 0 && invoice.paid > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("partlyPaid", {
                paid: money(invoice.paid),
                remaining: money(remaining),
              })}
            </p>
          ) : null}

          {waiting ? (
            <PendingProof proof={waiting} money={money} />
          ) : rejected ? (
            <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {t("proof.rejectedNote", {
                amount: money(rejected.amount),
                date: formatDate(rejected.createdAt, locale),
                reason: rejected.rejectionReason ?? "",
              })}
            </p>
          ) : null}
          {remaining > 0 && !waiting ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setSending(true)}
            >
              <Upload className="size-3.5" />
              {t("proof.send")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <SendProofDialog
        invoice={invoice}
        open={sending}
        onOpenChange={setSending}
      />
    </li>
  )
}

/** Proof the customer sent, waiting for the landlord: view or take back. */
function PendingProof({
  proof,
  money,
}: {
  proof: PortalInvoice["proofs"][number]
  money: (amount: number) => string
}) {
  const t = useTranslations("MyHome.invoices.proof")
  const locale = useLocale()
  const file = usePortalProofFile()
  const cancel = useCancelPaymentProof()

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
      <p>
        {t("pendingNote", {
          amount: money(proof.amount),
          date: formatDate(proof.paidOn, locale),
        })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <ProofFileButton id={proof.id} fetchFile={file} label={t("view")}>
          <span className="max-w-48 truncate">{proof.fileName}</span>
        </ProofFileButton>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ id: proof.id })}
        >
          {cancel.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
          {t("cancel")}
        </Button>
      </div>
    </div>
  )
}

/** "I've paid": what, when, and the file proving it, for the landlord. */
function SendProofDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: PortalInvoice
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("MyHome.invoices.proof")
  const submit = useSubmitPaymentProof()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) submit.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { number: invoice.number })}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PaymentForm
            id={`proof-${invoice.id}`}
            remaining={invoiceRemaining(invoice)}
            currency={invoice.currency}
            proof="required"
            submitLabel={t("submit")}
            pending={submit.isPending}
            onCancel={() => onOpenChange(false)}
            onSubmit={({ proof, ...values }) =>
              proof &&
              submit.mutate(
                { ...values, invoiceId: invoice.id, file: proof },
                { onSuccess: () => onOpenChange(false) }
              )
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function LineRow({ label, amount }: { label: string; amount: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{amount}</dd>
    </>
  )
}

/** Contracts the landlord sent: those waiting for the customer first. */
export function MyDocuments() {
  const t = useTranslations("MyHome.documents")
  const locale = useLocale()
  const { data: documents, isPending } = usePortalDocuments()

  if (isPending) {
    return <div className="h-20 animate-pulse rounded-lg bg-muted" />
  }
  if (!documents || documents.length === 0) return null

  const sorted = [...documents].sort(
    (a, b) =>
      Number(a.status === "completed") - Number(b.status === "completed")
  )

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{t("title")}</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((document) => {
          const toSign = document.status === "pending"
          return (
            <li key={document.id}>
              <Link
                href={myDocumentRoute(document.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50",
                  toSign &&
                    "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10"
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {toSign ? (
                    <Signature className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {document.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[
                      document.property,
                      toSign
                        ? document.sentAt &&
                          t("sentOn", {
                            date: formatDate(document.sentAt, locale),
                          })
                        : document.completedAt &&
                          t("signedOn", {
                            date: formatDate(document.completedAt, locale),
                          }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {toSign ? (
                  <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {t("signNow")}
                  </span>
                ) : (
                  <SignatureStatusBadge status={document.status} />
                )}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
