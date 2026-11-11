"use client"

import {
  invoiceRemaining,
  invoiceStatus,
  type InvoiceStatus,
} from "@workspace/api/invoice"
import { PAYMENT_PROOF_LIMITS } from "@workspace/api/invoice"
import { Badge } from "@workspace/ui/components/ui/badge"
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
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Field } from "@workspace/ui/components/ui/field"
import { Label } from "@workspace/ui/components/ui/label"
import { Textarea } from "@workspace/ui/components/ui/textarea"
import {
  Ban,
  Check,
  ChevronDownIcon,
  DotsHorizontal,
  HandCoins,
  Loader2,
  Receipt,
  Trash,
  X,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { PaymentDialog } from "@/components/customers/lease-dialogs"
import { ProofFileButton } from "@/components/invoices/proof-file-button"
import {
  AwaitingProofBadge,
  lastRejectedProof,
  pendingProof,
} from "@/components/invoices/proof-status"
import { routes } from "@/config/routes"
import {
  useConfirmPaymentProof,
  usePaymentProofFile,
  useRejectPaymentProof,
  useRemovePayment,
  useVoidInvoice,
  type CustomerInvoice,
  type CustomerLease,
} from "@/hooks/queries/customer"
import { formatDate, formatMoney } from "@/lib/format"

/** How many invoices a lease card shows before "Show all". */
const COLLAPSED = 3

type PaymentProof = CustomerInvoice["proofs"][number]

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useTranslations("Invoices.status")
  return (
    <Badge
      variant={
        status === "overdue"
          ? "destructive"
          : status === "paid"
            ? "secondary"
            : "outline"
      }
      className={cn(
        status === "paid" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        status === "void" && "text-muted-foreground line-through"
      )}
    >
      {t(status)}
    </Badge>
  )
}

/**
 * A lease's invoices, newest first, each with the payments recorded against
 * it: record a payment on one, print a receipt, or void one nothing was paid
 * on. Unpaid invoices always show; paid ones fold away after a few.
 */
export function LeaseInvoices({
  customerId,
  lease,
  today,
}: {
  customerId: string
  lease: CustomerLease
  today: string
}) {
  const t = useTranslations("Invoices")
  const [expanded, setExpanded] = useState(false)
  const [paying, setPaying] = useState<CustomerInvoice | null>(null)
  const [rejecting, setRejecting] = useState<PaymentProof | null>(null)

  if (lease.invoices.length === 0) return null

  const unpaid = lease.invoices.filter((i) => invoiceRemaining(i) > 0)
  const toReview = lease.invoices.filter((i) => pendingProof(i)).length
  const shown = expanded
    ? lease.invoices
    : lease.invoices.filter(
        (invoice, index) => index < COLLAPSED || invoiceRemaining(invoice) > 0
      )
  const hidden = lease.invoices.length - shown.length

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {t("title")}
        {unpaid.length > 0 ? (
          <span className="text-foreground">
            · {t("unpaidCount", { count: unpaid.length })}
          </span>
        ) : null}
        {toReview > 0 ? (
          <span className="text-amber-700 dark:text-amber-400">
            · {t("toReview", { count: toReview })}
          </span>
        ) : null}
      </h3>
      <ul className="-mx-2 flex flex-col">
        {shown.map((invoice) => (
          <InvoiceRow
            key={invoice.id}
            customerId={customerId}
            invoice={invoice}
            today={today}
            onPay={() => setPaying(invoice)}
            onReject={setRejecting}
          />
        ))}
      </ul>
      {hidden > 0 || expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setExpanded((open) => !open)}
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
          {expanded ? t("showLess") : t("showAll", { count: hidden })}
        </Button>
      ) : null}

      {paying ? (
        <PaymentDialog
          lease={lease}
          invoice={paying}
          open
          onOpenChange={(open) => !open && setPaying(null)}
        />
      ) : null}
      <RejectProofDialog
        proof={rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
      />
    </div>
  )
}

function InvoiceRow({
  customerId,
  invoice,
  today,
  onPay,
  onReject,
}: {
  customerId: string
  invoice: CustomerInvoice
  today: string
  onPay: () => void
  onReject: (proof: PaymentProof) => void
}) {
  const t = useTranslations("Invoices")
  const locale = useLocale()
  const voidInvoice = useVoidInvoice()
  const removePayment = useRemovePayment()
  const proofFile = usePaymentProofFile()
  const waiting = pendingProof(invoice)
  const rejected = lastRejectedProof(invoice)
  const status = invoiceStatus(invoice, today)
  const remaining = invoiceRemaining(invoice)
  const money = (amount: number) =>
    formatMoney(amount, invoice.currency, locale)

  return (
    <li className="flex flex-col rounded-md px-2 py-1.5 transition-colors hover:bg-background/70">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
          {invoice.number}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">
            {t("period", {
              start: formatDate(invoice.periodStart, locale),
              end: formatDate(invoice.periodEnd, locale),
            })}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {status === "paid" || status === "void"
              ? t("issuedOn", { date: formatDate(invoice.issuedOn, locale) })
              : t("dueOn", { date: formatDate(invoice.dueOn, locale) })}
            {invoice.lines.some((line) => line.kind === "deposit")
              ? ` · ${t("withDeposit")}`
              : ""}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span
            className={cn(
              "tabular-nums",
              status === "void" && "text-muted-foreground line-through"
            )}
          >
            {money(invoice.total)}
          </span>
          {invoice.paid > 0 && remaining > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("left", { amount: money(remaining) })}
            </span>
          ) : null}
        </span>
        {waiting ? (
          <AwaitingProofBadge label={t("proof.awaiting")} />
        ) : (
          <InvoiceStatusBadge status={status} />
        )}
        {status === "void" ? (
          <span className="size-6" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("actionsLabel", { number: invoice.number })}
                />
              }
            >
              <DotsHorizontal size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {remaining > 0 ? (
                <DropdownMenuItem onClick={onPay}>
                  <HandCoins className="size-4" />
                  {t("recordPayment")}
                </DropdownMenuItem>
              ) : null}
              {invoice.payments.length === 0 && !waiting ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={voidInvoice.isPending}
                  onClick={() => voidInvoice.mutate({ id: invoice.id })}
                >
                  <Ban className="size-4" />
                  {t("void")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {waiting ? (
        <ProofReview
          proof={waiting}
          money={money}
          proofFile={proofFile}
          onReject={() => onReject(waiting)}
        />
      ) : rejected ? (
        <p className="mt-1 ml-15 text-xs text-muted-foreground">
          {t("proof.rejectedNote", {
            amount: money(rejected.amount),
            sent: formatDate(rejected.createdAt, locale),
            reason: rejected.rejectionReason ?? "",
          })}
        </p>
      ) : null}

      {invoice.payments.length > 0 ? (
        <ul className="mt-1 ml-15 flex flex-col border-l pl-3">
          {invoice.payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground"
            >
              <span className="tabular-nums">
                {formatDate(payment.paidOn, locale)}
              </span>
              <span className="min-w-0 flex-1 truncate">{payment.note}</span>
              <span className="text-foreground tabular-nums">
                {money(payment.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("receipt")}
                title={t("receipt")}
                render={
                  <Link
                    href={`${routes.customers}/${customerId}/receipts/${payment.id}`}
                  />
                }
              >
                <Receipt size={12} />
              </Button>
              {payment.proof ? (
                <ProofFileButton
                  id={payment.proof.id}
                  fetchFile={proofFile}
                  label={t("viewProof")}
                />
              ) : null}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("removePayment")}
                disabled={removePayment.isPending}
                onClick={() => removePayment.mutate({ id: payment.id })}
              >
                <Trash size={12} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * The customer's proof of payment, waiting for the business: what they say
 * they paid and when, the file, and confirming (which records the payment)
 * or rejecting it.
 */
function ProofReview({
  proof,
  money,
  proofFile,
  onReject,
}: {
  proof: PaymentProof
  money: (amount: number) => string
  proofFile: ReturnType<typeof usePaymentProofFile>
  onReject: () => void
}) {
  const t = useTranslations("Invoices.proof")
  const locale = useLocale()
  const confirm = useConfirmPaymentProof()

  return (
    <div className="mt-1.5 ml-15 flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
      <p>
        {t("summary", {
          sent: formatDate(proof.createdAt, locale),
          amount: money(proof.amount),
          paidOn: formatDate(proof.paidOn, locale),
        })}
        {proof.note ? (
          <span className="text-muted-foreground"> · {proof.note}</span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <ProofFileButton id={proof.id} fetchFile={proofFile} label={t("view")}>
          <span className="max-w-40 truncate">{proof.fileName}</span>
        </ProofFileButton>
        <span className="flex-1" />
        <Button
          size="xs"
          variant="outline"
          disabled={confirm.isPending}
          onClick={onReject}
        >
          <X className="size-3" />
          {t("reject")}
        </Button>
        <Button
          size="xs"
          disabled={confirm.isPending}
          onClick={() => confirm.mutate({ id: proof.id })}
        >
          {confirm.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          {t("confirm")}
        </Button>
      </div>
    </div>
  )
}

/** Turns a proof of payment down, with the reason the customer is emailed. */
function RejectProofDialog({
  proof,
  onOpenChange,
}: {
  proof: PaymentProof | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Invoices.proof")
  const tc = useTranslations("Common")
  const reject = useRejectPaymentProof()
  const [reason, setReason] = useState("")
  const [shown, setShown] = useState<string | null>(null)
  // A fresh reason for each proof opened.
  if ((proof?.id ?? null) !== shown) {
    setShown(proof?.id ?? null)
    if (proof) setReason("")
  }

  return (
    <Dialog
      open={Boolean(proof)}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) reject.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rejectTitle")}</DialogTitle>
          <DialogDescription>{t("rejectDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!proof || !reason.trim()) return
            reject.mutate(
              { id: proof.id, reason: reason.trim() },
              { onSuccess: () => onOpenChange(false) }
            )
          }}
        >
          <Field>
            <Label htmlFor="reject-reason">{t("reason")}</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              maxLength={PAYMENT_PROOF_LIMITS.rejectionReason}
              placeholder={t("reasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
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
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
            >
              {reject.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("rejectSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
