"use client"

import {
  currentTermEnd,
  leaseBalance,
  leaseMonths,
  leaseStatus,
  localToday,
  monthlyDue,
  renewsAutomatically,
  NOTE_VISIBILITIES,
  CUSTOMER_LIMITS,
  type NoteVisibility,
} from "@workspace/api/lease"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Textarea } from "@workspace/ui/components/ui/textarea"
import {
  ArrowLeftIcon,
  Building2,
  CalendarX,
  Copy,
  DotsHorizontal,
  EyeOff,
  FilePen,
  HandCoins,
  Loader2,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Receipt,
  Trash,
  UserCircle,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import {
  BalanceSummary,
  LeaseDialog,
  PaymentDialog,
  TerminateLeaseDialog,
} from "@/components/customers/lease-dialogs"
import {
  GenerateContractDialog,
  CustomerDocuments,
  UploadDocumentDialog,
} from "@/components/customers/customer-documents"
import { LeaseBadge } from "@/components/customers/customer-list"
import {
  CustomerSheet,
  type CustomerEditor,
} from "@/components/customers/customer-sheet"
import { Section, SectionEmpty } from "@/components/customers/section"
import { UserAvatar } from "@/components/user-avatar"
import { routes } from "@/config/routes"
import {
  useAddCustomerNote,
  useDeleteLease,
  useDeleteCustomer,
  useRemovePayment,
  useRemoveCustomerNote,
  useCustomer,
  type CustomerDetail as Customer,
  type CustomerLease,
} from "@/hooks/queries/customer"
import { formatDate, formatMoney } from "@/lib/format"

/** One customer: who they are, what they rent, what they owe, and notes. */
export function CustomerDetail({ customerId }: { customerId: string }) {
  const t = useTranslations("Customer")
  const locale = useLocale()
  const { data: customer, isPending, isError } = useCustomer(customerId)
  const [editor, setEditor] = useState<CustomerEditor | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const today = localToday()

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" render={<Link href={routes.customers} />}>
          <ArrowLeftIcon isHovered className="size-4" />
          {t("back")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={routes.customers}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon isHovered className="size-4" />
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <UserAvatar name={customer.name} className="size-12 text-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-heading text-2xl font-medium tracking-[-0.02em]">
              {customer.name}
            </h1>
            {customer.banned ? (
              <Badge variant="destructive">{t("suspended")}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("since", { date: formatDate(customer.createdAt, locale) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setEditor({ mode: "edit", customerId: customer.id })}
          >
            <Pencil className="size-3.5" />
            {t("edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label={t("actions")} />
              }
            >
              <DotsHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  setEditor({ mode: "copy", customerId: customer.id })
                }
              >
                <Copy className="size-4" />
                {t("copy")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash size={16} />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <Section
            title={t("leasesTitle")}
            count={customer.leases.length}
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAssigning(true)}
              >
                <Plus size={14} />
                {t("assign")}
              </Button>
            }
          >
            {customer.leases.length === 0 ? (
              <SectionEmpty
                icon={<Building2 />}
                title={t("leasesEmpty")}
                description={t("leasesEmptyHint")}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {customer.leases.map((lease) => (
                  <LeaseCard
                    key={lease.id}
                    customer={customer}
                    lease={lease}
                    today={today}
                  />
                ))}
              </ul>
            )}
          </Section>

          <CustomerDocuments customer={customer} />

          <Notes customer={customer} />
        </div>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-6">
          <ContactDetails customer={customer} />
          <Contacts customer={customer} />
        </aside>
      </div>

      <LeaseDialog
        customerId={customer.id}
        open={assigning}
        onOpenChange={setAssigning}
      />
      <CustomerSheet editor={editor} onClose={() => setEditor(null)} />
      <DeleteCustomerDialog
        customer={customer}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </div>
  )
}

// Static glyphs for the contact rows: the animated Mail loops unless hovered.
const MailRow = ({ className }: { className?: string }) => (
  <Mail isHovered size={16} className={className} />
)
const PhoneRow = ({ className }: { className?: string }) => (
  <Phone className={className} />
)
const MapPinRow = ({ className }: { className?: string }) => (
  <MapPin className={className} />
)

function ContactDetails({ customer }: { customer: Customer }) {
  const t = useTranslations("Customer")

  const rows = [
    {
      icon: MailRow,
      value: customer.email,
      href: customer.email && `mailto:${customer.email}`,
    },
    {
      icon: PhoneRow,
      value: customer.phone,
      href: customer.phone && `tel:${customer.phone}`,
    },
    { icon: MapPinRow, value: customer.address, href: null },
  ].filter((row) => row.value)

  return (
    <Section title={t("detailsTitle")}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noContactDetails")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-sm">
          {rows.map(({ icon: Icon, value, href }) => (
            <li key={value} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {href ? (
                <a
                  href={href}
                  className="min-w-0 break-words underline-offset-4 hover:underline"
                >
                  {value}
                </a>
              ) : (
                <span className="min-w-0 break-words">{value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
        <UserCircle
          size={16}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">{t("account")}</span>
          <span className="truncate">{customer.email}</span>
        </span>
      </div>
    </Section>
  )
}

function Contacts({ customer }: { customer: Customer }) {
  const t = useTranslations("Customer")

  return (
    <Section title={t("contactsTitle")} count={customer.contacts.length}>
      {customer.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("contactsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {customer.contacts.map((contact, index) => (
            <li key={index} className="flex items-start gap-3">
              <UserAvatar name={contact.name} className="size-7 text-[10px]" />
              <span className="flex min-w-0 flex-col text-sm">
                <span className="truncate font-medium">{contact.name}</span>
                {contact.relation ? (
                  <span className="text-xs text-muted-foreground">
                    {contact.relation}
                  </span>
                ) : null}
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-1 truncate text-xs text-muted-foreground hover:text-foreground"
                  >
                    {contact.email}
                  </a>
                ) : null}
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {contact.phone}
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

type LeaseAction =
  | "edit"
  | "payment"
  | "terminate"
  | "delete"
  | "contract"
  | "attach"

function LeaseCard({
  customer,
  lease,
  today,
}: {
  customer: Customer
  lease: CustomerLease
  today: string
}) {
  const t = useTranslations("Leases")
  const locale = useLocale()
  const [action, setAction] = useState<LeaseAction | null>(null)
  const removePayment = useRemovePayment()
  const balance = leaseBalance(lease, lease.paid, today)
  const terminated = lease.terminatedAt !== null
  const status = leaseStatus(lease, today)
  const money = (amount: number) => formatMoney(amount, lease.currency, locale)
  const close = (open: boolean) => !open && setAction(null)
  const months = leaseMonths(lease)
  const renewal = renewsAutomatically(lease)
    ? currentTermEnd(lease, today)
    : null
  const extras = lease.charges + lease.additionalCosts

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground shadow-xs">
          <PropertyTypeIcon type={lease.property.type} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {lease.property.name}
            </span>
            <LeaseBadge lease={lease} today={today} />
            {terminated ? (
              <Badge variant="destructive">{t("terminated")}</Badge>
            ) : null}
          </div>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{lease.property.address}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {t("period", {
              start: formatDate(lease.startDate, locale),
              end: lease.endDate
                ? formatDate(lease.endDate, locale)
                : t("openEnded"),
            })}
            {months ? ` · ${t("termLength", { count: months })}` : null}
            {" · "}
            {t("perMonth", { amount: money(monthlyDue(lease)) })}
          </span>
          {renewal ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="size-3 shrink-0" />
              {t("renewsOn", { date: formatDate(renewal, locale) })}
            </span>
          ) : null}
          {extras > 0 || lease.discount > 0 || lease.deposit > 0 ? (
            <span className="text-xs text-muted-foreground">
              {[
                extras > 0
                  ? t("chargesLine", {
                      rent: money(lease.rent),
                      extras: money(extras),
                    })
                  : null,
                lease.discount > 0
                  ? t("discountLine", { amount: money(lease.discount) })
                  : null,
                lease.deposit > 0
                  ? t("depositLine", { amount: money(lease.deposit) })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("actionsLabel", {
                  property: lease.property.name,
                })}
              />
            }
          >
            <DotsHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setAction("payment")}>
              <HandCoins className="size-4" />
              {t("recordPayment")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("contract")}>
              <FilePen className="size-4" />
              {t("generateContract")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("attach")}>
              <Paperclip className="size-4" />
              {t("attachDocument")}
            </DropdownMenuItem>
            {terminated ? null : (
              <>
                <DropdownMenuItem onClick={() => setAction("edit")}>
                  <Pencil className="size-4" />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAction("terminate")}>
                  <CalendarX className="size-4" />
                  {t("terminate")}
                </DropdownMenuItem>
              </>
            )}
            {lease.payments.length === 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setAction("delete")}
                >
                  <Trash size={16} />
                  {t("delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {status === "upcoming" && lease.paid === 0 ? null : (
        <BalanceSummary
          balance={balance}
          currency={lease.currency}
          final={terminated}
          compact
        />
      )}

      {lease.payments.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("paymentsTitle")}
          </h3>
          <ul className="-mx-2 flex flex-col text-sm">
            {lease.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-background/70"
              >
                <span className="w-28 shrink-0 text-muted-foreground tabular-nums">
                  {formatDate(payment.paidOn, locale)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {payment.note}
                </span>
                <span className="tabular-nums">{money(payment.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("receipt")}
                  title={t("receipt")}
                  render={
                    <Link
                      href={`${routes.customers}/${customer.id}/receipts/${payment.id}`}
                    />
                  }
                >
                  <Receipt size={12} />
                </Button>
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
        </div>
      ) : null}

      <LeaseDialog
        lease={lease}
        open={action === "edit"}
        onOpenChange={close}
      />
      <PaymentDialog
        lease={lease}
        open={action === "payment"}
        onOpenChange={close}
      />
      <TerminateLeaseDialog
        lease={lease}
        open={action === "terminate"}
        onOpenChange={close}
      />
      <DeleteLeaseDialog
        lease={lease}
        open={action === "delete"}
        onOpenChange={close}
      />
      <GenerateContractDialog
        customer={customer}
        lease={lease}
        open={action === "contract"}
        onOpenChange={close}
      />
      <UploadDocumentDialog
        customer={customer}
        leaseId={lease.id}
        open={action === "attach"}
        onOpenChange={close}
      />
    </li>
  )
}

function DeleteLeaseDialog({
  lease,
  open,
  onOpenChange,
}: {
  lease: CustomerLease
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const remove = useDeleteLease()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("deleteTitle", { property: lease.property.name })}
          </DialogTitle>
          <DialogDescription>{t("deleteDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(
                { id: lease.id },
                { onSuccess: () => onOpenChange(false) }
              )
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

function Notes({ customer }: { customer: Customer }) {
  const t = useTranslations("Customer")
  const locale = useLocale()
  const [body, setBody] = useState("")
  const [visibility, setVisibility] = useState<NoteVisibility>("private")
  const addNote = useAddCustomerNote()
  const removeNote = useRemoveCustomerNote()
  const trimmed = body.trim()

  return (
    <Section title={t("notesTitle")} count={customer.notes.length}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!trimmed) return
          addNote.mutate(
            { customerId: customer.id, body: trimmed, visibility },
            { onSuccess: () => setBody("") }
          )
        }}
      >
        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-[background-color,box-shadow] focus-within:bg-background focus-within:shadow-sm focus-within:ring-1 focus-within:ring-border">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={CUSTOMER_LIMITS.note}
            rows={2}
            placeholder={t("notePlaceholder")}
            aria-label={t("notesTitle")}
            className="min-h-14 resize-none border-none px-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="radiogroup"
              aria-label={t("visibilityLabel")}
              className="flex gap-0.5 rounded-lg bg-muted/80 p-0.5"
            >
              {NOTE_VISIBILITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={visibility === value}
                  onClick={() => setVisibility(value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    visibility === value
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value === "private" ? (
                    <Lock isHovered size={12} />
                  ) : (
                    <UserCircle size={12} />
                  )}
                  {t(`visibility.${value}`)}
                </button>
              ))}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!trimmed || addNote.isPending}
            >
              {addNote.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("addNote")}
            </Button>
          </div>
        </div>
      </form>

      {customer.notes.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{t("notesEmpty")}</p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {customer.notes.map((note) => (
            <li
              key={note.id}
              className="group flex flex-col gap-1.5 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate font-medium text-foreground">
                  {note.authorName}
                </span>
                <span>{formatDate(note.createdAt, locale)}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 py-px",
                    note.visibility === "shared"
                      ? "bg-brand-subtle text-brand"
                      : "bg-muted"
                  )}
                >
                  {note.visibility === "private" ? (
                    <EyeOff className="size-3" />
                  ) : (
                    <UserCircle size={12} />
                  )}
                  {t(`visibilityBadge.${note.visibility}`)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={t("removeNote")}
                  disabled={removeNote.isPending}
                  onClick={() =>
                    removeNote.mutate({ customerId: customer.id, id: note.id })
                  }
                >
                  <Trash size={12} />
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/**
 * Once rent has been paid, the customer stays on record: the dialog explains
 * that instead of offering to delete. The server enforces the same rule.
 */
function DeleteCustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Customer")
  const tc = useTranslations("Common")
  const router = useRouter()
  const remove = useDeleteCustomer()
  const hasPayments = customer.leases.some((lease) => lease.payments.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hasPayments
              ? t("cantDeleteTitle", { name: customer.name })
              : t("deleteTitle", { name: customer.name })}
          </DialogTitle>
          <DialogDescription>
            {hasPayments
              ? t("cantDeleteDescription")
              : customer.leases.length > 0
                ? t("deleteWithLeasesDescription", {
                    count: customer.leases.length,
                  })
                : t("deleteDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {hasPayments ? t("close") : tc("cancel")}
          </Button>
          {hasPayments ? null : (
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { id: customer.id },
                  {
                    onSuccess: () => {
                      onOpenChange(false)
                      router.push(routes.customers)
                    },
                  }
                )
              }
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("deleteSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
