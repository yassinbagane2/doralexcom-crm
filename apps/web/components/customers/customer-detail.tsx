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
  customerGroups,
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
  Users,
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

  const groups = customerGroups(customer.leases, today)

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={routes.customers}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon isHovered className="size-4" />
        {t("back")}
      </Link>

      <div className="flex items-start gap-4">
        <UserAvatar name={customer.name} className="size-12 text-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="truncate font-heading text-2xl font-medium tracking-[-0.02em]">
            {customer.name}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {groups.size === 0 ? (
              <Badge variant="outline">{t("noLease")}</Badge>
            ) : (
              [...groups].map((group) => (
                <Badge
                  key={group}
                  variant={group === "current" ? "default" : "outline"}
                >
                  {t(`groups.${group}`)}
                </Badge>
              ))
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="icon"
                aria-label={t("actions")}
              />
            }
          >
            <DotsHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() =>
                setEditor({ mode: "edit", customerId: customer.id })
              }
            >
              <Pencil className="size-4" />
              {t("edit")}
            </DropdownMenuItem>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">{t("leasesTitle")}</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAssigning(true)}
              >
                <Plus size={14} />
                {t("assign")}
              </Button>
            </div>
            {customer.leases.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("leasesEmpty")}
              </p>
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
          </section>

          <CustomerDocuments customer={customer} />

          <Notes customer={customer} />
        </div>

        <aside className="flex flex-col gap-6">
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
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">{t("detailsTitle")}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noContactDetails")}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map(({ icon: Icon, value, href }) => (
            <li key={value} className="flex items-start gap-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {href ? (
                <a href={href} className="min-w-0 break-words hover:underline">
                  {value}
                </a>
              ) : (
                <span className="min-w-0 break-words">{value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2 border-t pt-3 text-sm">
        <UserCircle
          size={16}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            {t("account")}
            {customer.banned ? (
              <Badge variant="destructive">{t("suspended")}</Badge>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {customer.email}
          </span>
        </span>
      </div>
    </section>
  )
}

function Contacts({ customer }: { customer: Customer }) {
  const t = useTranslations("Customer")

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Users size={16} className="text-muted-foreground" />
        {t("contactsTitle")}
      </h2>
      {customer.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("contactsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {customer.contacts.map((contact, index) => (
            <li key={index} className="flex flex-col text-sm">
              <span className="font-medium">
                {contact.name}
                {contact.relation ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {contact.relation}
                  </span>
                ) : null}
              </span>
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="truncate text-xs text-muted-foreground hover:underline"
                >
                  {contact.email}
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {contact.phone}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <li className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
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
        />
      )}

      {lease.payments.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("paymentsTitle")}
          </h3>
          <ul className="flex flex-col divide-y rounded-md border text-sm">
            {lease.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 px-3 py-1.5"
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
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{t("notesTitle")}</h2>

      <form
        className="flex flex-col gap-2 rounded-lg border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!trimmed) return
          addNote.mutate(
            { customerId: customer.id, body: trimmed, visibility },
            { onSuccess: () => setBody("") }
          )
        }}
      >
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={CUSTOMER_LIMITS.note}
          rows={2}
          placeholder={t("notePlaceholder")}
          aria-label={t("notesTitle")}
          className="border-none px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="radiogroup"
            aria-label={t("visibilityLabel")}
            className="flex gap-1"
          >
            {NOTE_VISIBILITIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={visibility === value}
                onClick={() => setVisibility(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                  visibility === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      </form>

      {customer.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("notesEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {customer.notes.map((note) => (
            <li
              key={note.id}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5",
                note.visibility === "shared" &&
                  "border-brand/30 bg-brand-subtle/40"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {note.visibility === "private" ? (
                  <EyeOff className="size-3" />
                ) : (
                  <UserCircle size={12} />
                )}
                <span>{t(`visibilityBadge.${note.visibility}`)}</span>
                <span>·</span>
                <span className="truncate">
                  {[note.authorName, formatDate(note.createdAt, locale)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label={t("removeNote")}
                  disabled={removeNote.isPending}
                  onClick={() =>
                    removeNote.mutate({ customerId: customer.id, id: note.id })
                  }
                >
                  <Trash size={12} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
