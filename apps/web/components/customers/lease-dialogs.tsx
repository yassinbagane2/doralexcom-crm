"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CONTRACT_LIMITS, signatureRoles } from "@workspace/api/contract"
import {
  invoiceRemaining,
  reconciledBalance,
  reconcileInvoices,
} from "@workspace/api/invoice"
import {
  addDays,
  billingPeriods,
  localToday,
  MAX_TERM_MONTHS,
  monthlyDue,
  termEndDate,
} from "@workspace/api/lease"
import {
  PROPERTY_LIMITS,
  RENT_CURRENCIES,
  type RentCurrency,
} from "@workspace/api/property"
import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
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
import { FileText, Loader2, Receipt } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, type Control } from "react-hook-form"
import { z } from "zod"

import {
  fillContract,
  useMergeValues,
} from "@/components/contracts/contract-content"
import { PaymentForm } from "@/components/invoices/payment-form"
import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import { InfinitePicker } from "@/components/shared/infinite-picker"
import { UserAvatar } from "@/components/shared/user-avatar"
import { routes } from "@/config/routes"
import { usePropertyPages, type Property } from "@/hooks/queries/property"
import { useBusinessSignature } from "@/hooks/queries/signature"
import {
  useAddPayment,
  useCreateLease,
  useTerminateLease,
  useUpdateLease,
  useCustomerPages,
  type CustomerSummary,
  type LeaseBalance,
  type CustomerInvoice,
  type CustomerLease,
} from "@/hooks/queries/customer"
import { parseAmount, useAmount } from "@/hooks/use-amount"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatDate, formatMoney } from "@/lib/format"
import { orpc } from "@/lib/orpc"

/**
 * Counts how many times `open` has turned true. Keying a dialog on it gives
 * each opening a fresh form, while closing (and its animation) leaves the
 * current one alone.
 */
function useOpenSession(open: boolean) {
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }
  return session
}

// --- Assign a property / edit a lease's terms --------------------------------

const LENGTH_MODES = ["open", "months", "date"] as const

type LengthMode = (typeof LENGTH_MODES)[number]

interface LeaseFormValues {
  propertyId: string
  customerId: string
  /** New leases only: the template their lease document is generated from. */
  templateId: string
  startDate: string
  /** How the lease's end is set: not at all, by a length, or by a date. */
  lengthMode: LengthMode
  termMonths: string
  endDate: string
  autoRenew: boolean
  rent: string
  currency: RentCurrency
  charges: string
  additionalCosts: string
  discount: string
  deposit: string
}

type LeaseFormOutput = Omit<
  LeaseFormValues,
  | "rent"
  | "charges"
  | "additionalCosts"
  | "discount"
  | "deposit"
  | "termMonths"
  | "endDate"
> & {
  rent: number
  charges: number
  additionalCosts: number
  discount: number
  deposit: number
  termMonths: number | null
  endDate: string | null
}

/** The length a lease's form opens with: how its end was set. */
function lengthModeOf(lease: CustomerLease | undefined): LengthMode {
  if (lease?.termMonths) return "months"
  return lease?.endDate ? "date" : "open"
}

/** "12" reads as 12 months; anything else isn't a length. */
function parseMonths(value: string) {
  const months = Number(value.trim())
  return Number.isInteger(months) && months >= 1 && months <= MAX_TERM_MONTHS
    ? months
    : null
}

type LeaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
} & (
  | /** From a customer's page: pick the property. */
    { customerId: string; property?: never; lease?: never }
  /** From the properties page: pick the customer. */
  | { property: Property; customerId?: never; lease?: never }
  /** Change an existing lease's dates, rent and terms. */
  | { lease: CustomerLease; customerId?: never; property?: never }
)

/**
 * Creates a lease: a customer occupying a property from an entry date, for a
 * number of months, until an exit date, or open-ended, with what's billed
 * each month besides the rent and the deposit held. Opened from either side,
 * so it asks for whichever of customer and property isn't given. A new lease
 * comes with its lease document, filled in from a template with these terms
 * and saved with the lease. Editing changes all the terms of an existing
 * lease.
 */
export function LeaseDialog(props: LeaseDialogProps) {
  return <LeaseDialogBody key={useOpenSession(props.open)} {...props} />
}

function LeaseDialogBody({
  customerId,
  property,
  lease,
  open,
  onOpenChange,
}: LeaseDialogProps) {
  const pickProperty = !lease && !property
  const pickCustomer = !lease && !customerId
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const locale = useLocale()
  const td = useTranslations("Documents")
  const create = useCreateLease()
  const update = useUpdateLease()
  const queryClient = useQueryClient()
  const mergeValues = useMergeValues()
  const [generating, setGenerating] = useState(false)
  // A new lease's contract is signed for the business and sent to the
  // customer right away, so it can't be created without that signature.
  const businessSignature = useBusinessSignature()
  const needsSignature =
    !lease && businessSignature.isSuccess && !businessSignature.data
  const [propertySearch, setPropertySearch] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [pickedProperty, setPickedProperty] = useState<Property | null>(null)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerSummary | null>(
    null
  )
  const propertyQuery = useDebouncedValue(propertySearch.trim())
  const customerQuery = useDebouncedValue(customerSearch.trim())
  const propertyPages = usePropertyPages({
    search: propertyQuery,
    enabled: pickProperty,
  })
  const customerPages = useCustomerPages({
    search: customerQuery,
    today: localToday(),
    enabled: pickCustomer,
  })
  const properties = propertyPages.data?.pages.flatMap((page) => page.data)
  const customers = customerPages.data?.pages.flatMap((page) => page.data)
  // Whether the business has none at all, not just none matching a search.
  const noProperties =
    !propertyQuery && propertyPages.data?.pages[0]?.total === 0
  const noCustomers =
    !customerQuery && customerPages.data?.pages[0]?.total === 0
  const { data: templates } = useQuery({
    ...orpc.contract.listTemplates.queryOptions(),
    enabled: !lease,
  })
  const amount = useAmount()
  const tv = useTranslations("Leases.validation")

  const schema = useMemo(
    () =>
      z
        .object({
          propertyId: z.string().min(1, tv("propertyRequired")),
          customerId: z.string().min(1, tv("customerRequired")),
          templateId: z.string().min(1, tv("templateRequired")),
          startDate: z.iso.date(tv("dateRequired")),
          lengthMode: z.enum(LENGTH_MODES),
          termMonths: z.string(),
          endDate: z.string(),
          autoRenew: z.boolean(),
          rent: amount({ required: false, max: PROPERTY_LIMITS.rent }),
          currency: z.enum(RENT_CURRENCIES),
          charges: amount({ required: false, max: PROPERTY_LIMITS.rent }),
          additionalCosts: amount({
            required: false,
            max: PROPERTY_LIMITS.rent,
          }),
          discount: amount({ required: false, max: PROPERTY_LIMITS.rent }),
          deposit: amount({ required: false, max: PROPERTY_LIMITS.rent }),
        })
        .superRefine((values, ctx) => {
          if (values.lengthMode === "months" && !parseMonths(values.termMonths))
            ctx.addIssue({
              code: "custom",
              message: tv("monthsInvalid"),
              path: ["termMonths"],
            })
          if (values.lengthMode === "date") {
            if (!z.iso.date().safeParse(values.endDate).success)
              ctx.addIssue({
                code: "custom",
                message: tv("dateRequired"),
                path: ["endDate"],
              })
            else if (values.endDate < values.startDate)
              ctx.addIssue({
                code: "custom",
                message: tv("endBeforeStart"),
                path: ["endDate"],
              })
          }
        })
        .transform((values): LeaseFormOutput => {
          const months =
            values.lengthMode === "months"
              ? parseMonths(values.termMonths)
              : null
          return {
            ...values,
            termMonths: months,
            endDate: months
              ? termEndDate(values.startDate, months)
              : values.lengthMode === "date"
                ? values.endDate
                : null,
            // Only a lease agreed in months has a term to renew.
            autoRenew: months !== null && values.autoRenew,
          }
        }),
    [amount, tv]
  )

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: lease
      ? {
          propertyId: lease.property.id,
          // Not edited: the lease keeps its customer and its documents.
          customerId: "unchanged",
          templateId: "unchanged",
          startDate: lease.startDate,
          lengthMode: lengthModeOf(lease),
          termMonths: lease.termMonths ? String(lease.termMonths) : "12",
          endDate: lease.endDate ?? "",
          autoRenew: lease.autoRenew,
          rent: String(lease.rent),
          currency: lease.currency,
          charges: lease.charges ? String(lease.charges) : "",
          additionalCosts: lease.additionalCosts
            ? String(lease.additionalCosts)
            : "",
          discount: lease.discount ? String(lease.discount) : "",
          deposit: lease.deposit ? String(lease.deposit) : "",
        }
      : {
          propertyId: property?.id ?? "",
          customerId: customerId ?? "",
          templateId: "",
          startDate: localToday(),
          lengthMode: "open",
          termMonths: "12",
          endDate: "",
          autoRenew: false,
          // Unused: a new lease takes the property's rent.
          rent: "",
          currency: "RON",
          charges: "",
          additionalCosts: "",
          discount: "",
          deposit: "",
        },
  })
  const { errors } = form.formState
  const isPending = generating || create.isPending || update.isPending

  // With a single template there's nothing to choose: preselect it.
  const onlyTemplate = templates?.length === 1 ? templates[0]!.id : null
  useEffect(() => {
    if (onlyTemplate && !form.getValues("templateId")) {
      form.setValue("templateId", onlyTemplate)
    }
  }, [form, onlyTemplate])

  const chosenProperty = property ?? pickedProperty ?? undefined
  // What the lease is billed in: its own currency, or a new one's property's.
  const currency = lease ? form.watch("currency") : chosenProperty?.currency
  const lengthMode = form.watch("lengthMode")
  const startDate = form.watch("startDate")
  const months = parseMonths(form.watch("termMonths"))
  const termEnd =
    months && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? termEndDate(startDate, months)
      : null
  const charges = {
    rent: lease
      ? (parseAmount(form.watch("rent")) ?? 0)
      : (chosenProperty?.rent ?? 0),
    charges: parseAmount(form.watch("charges")) ?? 0,
    additionalCosts: parseAmount(form.watch("additionalCosts")) ?? 0,
    discount: parseAmount(form.watch("discount")) ?? 0,
  }
  const monthly = monthlyDue(charges)

  // What saving an edit does to the customer's invoices, worked out the way
  // the server will: null until the dates entered make sense.
  const endDateField = form.watch("endDate")
  const autoRenew = form.watch("autoRenew")
  const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  const editedEnd =
    lengthMode === "months"
      ? termEnd
      : lengthMode === "date"
        ? isDay(endDateField) && endDateField >= startDate
          ? endDateField
          : undefined
        : null
  const invoicePlan =
    lease && isDay(startDate) && editedEnd !== undefined
      ? planInvoices(lease, {
          ...charges,
          startDate,
          endDate: editedEnd,
          termMonths: lengthMode === "months" ? months : null,
          autoRenew: lengthMode === "months" && autoRenew,
          deposit: parseAmount(form.watch("deposit")) ?? 0,
        })
      : null

  const templateItems = (templates ?? []).map((template) => ({
    value: template.id,
    label: template.name,
  }))
  const lengthItems = LENGTH_MODES.map((value) => ({
    value,
    label: t(`lengthModes.${value}`),
  }))

  const extraAmount = (
    name: "charges" | "additionalCosts" | "discount" | "deposit"
  ) => (
    <Field>
      <Label htmlFor={`lease-${name}`}>
        {t(`fields.${name}`)}{" "}
        <span className="font-normal text-muted-foreground">
          ({tc("optional").toLowerCase()})
        </span>
      </Label>
      <div className="relative">
        <Input
          id={`lease-${name}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={Boolean(errors[name])}
          className={currency ? "pr-12" : undefined}
          {...form.register(name)}
        />
        {currency ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {currency}
          </span>
        ) : null}
      </div>
      <FieldError>{errors[name]?.message}</FieldError>
    </Field>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          create.reset()
          update.reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lease
              ? t("editTitle")
              : pickCustomer
                ? t("assignCustomerTitle", { property: property!.name })
                : t("assignTitle")}
          </DialogTitle>
          <DialogDescription>
            {lease
              ? t("editDescription", { property: lease.property.name })
              : t("assignDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="mt-5 flex flex-col gap-5"
          onSubmit={form.handleSubmit(async (values) => {
            const agreement = {
              startDate: values.startDate,
              endDate: values.endDate,
              termMonths: values.termMonths,
              autoRenew: values.autoRenew,
              charges: values.charges,
              additionalCosts: values.additionalCosts,
              discount: values.discount,
              deposit: values.deposit,
            }
            if (lease) {
              update.mutate(
                {
                  ...agreement,
                  rent: values.rent,
                  currency: values.currency,
                  id: lease.id,
                },
                { onSuccess: () => onOpenChange(false) }
              )
              return
            }
            // A new lease takes the property's rent, set by the server, and
            // its lease document: the template filled in with the terms as
            // the server will save them, created along with the lease.
            const parties = {
              customerId: values.customerId,
              propertyId: values.propertyId,
            }
            setGenerating(true)
            try {
              const [template, data] = await Promise.all([
                queryClient.fetchQuery(
                  orpc.contract.getTemplate.queryOptions({
                    input: { id: values.templateId },
                    staleTime: 0,
                  })
                ),
                queryClient.fetchQuery(
                  orpc.lease.draftMergeData.queryOptions({
                    input: { ...agreement, ...parties },
                    staleTime: 0,
                  })
                ),
              ])
              const content = fillContract(template.content, mergeValues(data))
              // The customer signs it straight away, so it needs a place to.
              const signable = signatureRoles(
                content.body,
                content.header,
                content.footer
              ).has("customer")
              if (!signable) {
                form.setError("templateId", {
                  message: t("templateNotSignable"),
                })
                return
              }
              await create.mutateAsync({
                ...agreement,
                ...parties,
                contract: {
                  name: td("contractName", {
                    template: template.name,
                    customer: data.customer.name,
                  }).slice(0, CONTRACT_LIMITS.name),
                  content,
                },
              })
              onOpenChange(false)
            } catch {
              // The request's own error toast says what went wrong.
            } finally {
              setGenerating(false)
            }
          })}
        >
          {pickCustomer ? (
            <Field>
              <Label htmlFor="lease-customer">{t("fields.customer")}</Label>
              <Controller
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <InfinitePicker
                    id="lease-customer"
                    items={customers ?? []}
                    query={customerPages}
                    value={pickedCustomer}
                    onValueChange={(customer) => {
                      setPickedCustomer(customer)
                      field.onChange(customer.id)
                    }}
                    search={customerSearch}
                    onSearchChange={setCustomerSearch}
                    itemLabel={(customer) => customer.name}
                    renderItem={(customer) => (
                      <>
                        <UserAvatar
                          name={customer.name}
                          className="size-5 text-[10px]"
                        />
                        <span className="truncate">{customer.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {customer.email}
                        </span>
                      </>
                    )}
                    placeholder={t("customerPlaceholder")}
                    searchPlaceholder={t("searchCustomers")}
                    emptyText={t("noMatches")}
                    invalid={Boolean(errors.customerId)}
                  />
                )}
              />
              {noCustomers ? (
                <p className="text-xs text-muted-foreground">
                  {t("noCustomers")}
                </p>
              ) : null}
              <FieldError>{errors.customerId?.message}</FieldError>
            </Field>
          ) : null}

          {!pickProperty ? null : (
            <Field>
              <Label htmlFor="lease-property">{t("fields.property")}</Label>
              <Controller
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <InfinitePicker
                    id="lease-property"
                    items={properties ?? []}
                    query={propertyPages}
                    value={pickedProperty}
                    onValueChange={(picked) => {
                      setPickedProperty(picked)
                      field.onChange(picked.id)
                    }}
                    search={propertySearch}
                    onSearchChange={setPropertySearch}
                    itemLabel={(picked) => picked.name}
                    renderItem={(picked) => (
                      <>
                        <PropertyTypeIcon
                          type={picked.type}
                          className="text-muted-foreground"
                        />
                        <span className="truncate">{picked.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {picked.address}
                        </span>
                      </>
                    )}
                    placeholder={t("propertyPlaceholder")}
                    searchPlaceholder={t("searchProperties")}
                    emptyText={t("noMatches")}
                    invalid={Boolean(errors.propertyId)}
                  />
                )}
              />
              {noProperties ? (
                <p className="text-xs text-muted-foreground">
                  {t("noProperties")}
                </p>
              ) : null}
              <FieldError>{errors.propertyId?.message}</FieldError>
            </Field>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <Label htmlFor="lease-start">{t("fields.startDate")}</Label>
              <Input
                id="lease-start"
                type="date"
                aria-invalid={Boolean(errors.startDate)}
                {...form.register("startDate")}
              />
              <FieldError>{errors.startDate?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="lease-length">{t("fields.length")}</Label>
              <Controller
                control={form.control}
                name="lengthMode"
                render={({ field }) => (
                  <Select
                    items={lengthItems}
                    value={field.value}
                    onValueChange={(value) =>
                      value && field.onChange(value as LengthMode)
                    }
                  >
                    <SelectTrigger id="lease-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lengthItems.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          {lengthMode === "months" ? (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
              <Field>
                <Label htmlFor="lease-months">{t("fields.termMonths")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="lease-months"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-24"
                    aria-invalid={Boolean(errors.termMonths)}
                    {...form.register("termMonths")}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("monthsUnit")}
                  </span>
                  {termEnd ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t("endsOn", { date: formatDate(termEnd, locale) })}
                    </span>
                  ) : null}
                </div>
                <FieldError>{errors.termMonths?.message}</FieldError>
              </Field>
              <Controller
                control={form.control}
                name="autoRenew"
                render={({ field }) => (
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="lease-renew"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="lease-renew" className="font-normal">
                        {t("fields.autoRenew")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("autoRenewHint")}
                      </p>
                    </div>
                  </div>
                )}
              />
            </div>
          ) : lengthMode === "date" ? (
            <Field>
              <Label htmlFor="lease-end">{t("fields.endDate")}</Label>
              <Input
                id="lease-end"
                type="date"
                min={startDate}
                aria-invalid={Boolean(errors.endDate)}
                {...form.register("endDate")}
              />
              <FieldError>{errors.endDate?.message}</FieldError>
            </Field>
          ) : null}

          {lease ? (
            <Field>
              <Label htmlFor="lease-rent">{t("fields.rent")}</Label>
              <div className="flex gap-2">
                <Input
                  id="lease-rent"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="2500"
                  aria-invalid={Boolean(errors.rent)}
                  {...form.register("rent")}
                />
                <CurrencySelect control={form.control} />
              </div>
              <p className="text-xs text-muted-foreground">{t("rentHint")}</p>
              <FieldError>{errors.rent?.message}</FieldError>
            </Field>
          ) : (
            <PropertyRent property={chosenProperty} />
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {extraAmount("charges")}
            {extraAmount("additionalCosts")}
            {extraAmount("discount")}
            {extraAmount("deposit")}
          </div>
          {currency && monthly > 0 ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              {t("monthlyHint", {
                amount: formatMoney(monthly, currency, locale),
              })}
            </p>
          ) : null}

          {lease ? null : (
            <Field>
              <Label htmlFor="lease-template">{t("fields.document")}</Label>
              <Controller
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <Select
                    items={templateItems}
                    value={field.value || null}
                    onValueChange={(value) => value && field.onChange(value)}
                  >
                    <SelectTrigger
                      id="lease-template"
                      aria-invalid={Boolean(errors.templateId)}
                    >
                      <SelectValue placeholder={td("templatePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {templateItems.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          <FileText className="text-muted-foreground" />
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                {templates && templates.length === 0
                  ? td.rich("noTemplates", {
                      link: (chunks) => (
                        <Link
                          href={`${routes.templates}/new`}
                          className="font-medium text-foreground underline underline-offset-4"
                        >
                          {chunks}
                        </Link>
                      ),
                    })
                  : t("documentHint")}
              </p>
              <FieldError>{errors.templateId?.message}</FieldError>
            </Field>
          )}

          {invoicePlan && currency ? (
            <InvoiceNotice plan={invoicePlan} currency={currency} />
          ) : null}

          {needsSignature ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              {t.rich("signatureSetup", {
                link: (chunks) => (
                  <Link
                    href={routes.accountSignature}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : null}

          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || needsSignature}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {lease
                ? invoicePlan?.issued.length
                  ? t("invoiceNotice.saveAndSend", {
                      count: invoicePlan.issued.length,
                    })
                  : tc("saveChanges")
                : pickCustomer
                  ? t("assignCustomerSubmit")
                  : t("assignSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** What saving a lease's new terms does to its invoices. */
interface InvoicePlan {
  /** Unpaid invoices cancelled because their month no longer fits. */
  cancelled: string[]
  /** Invoices issued and emailed to the customer as soon as it's saved. */
  issued: { start: string; end: string; total: number }[]
  /** The amounts changed, but only invoices from `nextOn` on use them. */
  amountsChanged: boolean
  nextOn: string | null
}

function planInvoices(
  lease: CustomerLease,
  edited: Parameters<typeof reconcileInvoices>[1] & { deposit: number }
): InvoicePlan {
  const today = localToday()
  const { toVoid, toIssue } = reconcileInvoices(lease.invoices, edited, today)
  const nextOn =
    billingPeriods(edited, addDays(today, 32)).find(
      (period) => period.start > today
    )?.start ?? null
  return {
    cancelled: lease.invoices
      .filter((invoice) => toVoid.includes(invoice.id))
      .map((invoice) => invoice.number),
    issued: toIssue.map(({ period, total }) => ({
      start: period.start,
      end: period.end,
      total,
    })),
    amountsChanged:
      monthlyDue(edited) !== monthlyDue(lease) ||
      edited.deposit !== lease.deposit,
    nextOn,
  }
}

/**
 * Tells the business, before it saves, which invoices its edit sends the
 * customer (and which it cancels), or that sent invoices stay as they are.
 */
function InvoiceNotice({
  plan,
  currency,
}: {
  plan: InvoicePlan
  currency: string
}) {
  const t = useTranslations("Leases.invoiceNotice")
  const locale = useLocale()

  if (plan.issued.length === 0 && plan.cancelled.length === 0) {
    if (!plan.amountsChanged) return null
    return (
      <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        {plan.nextOn
          ? t("amountsLater", { date: formatDate(plan.nextOn, locale) })
          : t("amountsUnchanged")}
      </p>
    )
  }

  return (
    <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <Receipt className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-medium">
          {plan.issued.length > 0
            ? t("newTitle", { count: plan.issued.length })
            : t("cancelTitle", { count: plan.cancelled.length })}
        </p>
        {plan.issued.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs">
            {plan.issued.map((invoice) => (
              <li key={invoice.start} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t("period", {
                    start: formatDate(invoice.start, locale),
                    end: formatDate(invoice.end, locale),
                  })}
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(invoice.total, currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {plan.cancelled.length > 0
            ? t(plan.issued.length > 0 ? "replaces" : "cancels", {
                count: plan.cancelled.length,
                numbers: plan.cancelled.join(", "),
              })
            : null}{" "}
          {plan.issued.length > 0 ? t("emailed") : null}
        </p>
      </div>
    </div>
  )
}

/** The rent a new lease will take, straight from the property. */
function PropertyRent({ property }: { property: Property | undefined }) {
  const t = useTranslations("Leases")
  const locale = useLocale()

  if (!property) return null

  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
      {property.rent != null && property.rent > 0 ? (
        <>
          <span className="text-muted-foreground">{t("fields.rent")}: </span>
          <span className="font-medium tabular-nums">
            {t("perMonth", {
              amount: formatMoney(property.rent, property.currency, locale),
            })}
          </span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("rentFromProperty")}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">{t("noPropertyRent")}</p>
      )}
    </div>
  )
}

function CurrencySelect({
  control,
}: {
  control: Control<LeaseFormValues, unknown, LeaseFormOutput>
}) {
  const t = useTranslations("Leases")
  const items = RENT_CURRENCIES.map((value) => ({ value, label: value }))

  return (
    <Controller
      control={control}
      name="currency"
      render={({ field }) => (
        <Select
          items={items}
          value={field.value}
          onValueChange={(value) =>
            value && field.onChange(value as RentCurrency)
          }
        >
          <SelectTrigger
            aria-label={t("fields.currency")}
            className="w-24 shrink-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )
}

// --- Record a payment --------------------------------------------------------

/** A dialog about one existing lease. */
type ExistingLeaseDialogProps = {
  lease: CustomerLease
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PaymentDialogProps = ExistingLeaseDialogProps & {
  /** The invoice the payment settles, in whole or in part. */
  invoice: CustomerInvoice
}

export function PaymentDialog(props: PaymentDialogProps) {
  return <PaymentDialogBody key={useOpenSession(props.open)} {...props} />
}

function PaymentDialogBody({
  lease,
  invoice,
  open,
  onOpenChange,
}: PaymentDialogProps) {
  const t = useTranslations("Leases")
  const locale = useLocale()
  const addPayment = useAddPayment()
  const remaining = invoiceRemaining(invoice)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) addPayment.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("paymentTitle")}</DialogTitle>
          <DialogDescription>
            {t("paymentDescription", {
              number: invoice.number,
              property: lease.property.name,
              remaining: formatMoney(remaining, lease.currency, locale),
            })}
          </DialogDescription>
        </DialogHeader>
        <PaymentForm
          id="payment"
          remaining={remaining}
          currency={lease.currency}
          proof="optional"
          submitLabel={t("paymentSubmit")}
          pending={addPayment.isPending}
          onCancel={() => onOpenChange(false)}
          onSubmit={(values) =>
            addPayment.mutate(
              { ...values, invoiceId: invoice.id },
              { onSuccess: () => onOpenChange(false) }
            )
          }
        />
      </DialogContent>
    </Dialog>
  )
}

// --- Terminate a lease -------------------------------------------------------

/**
 * Ends the lease on an exit date, previewing what the customer will owe (or be
 * owed) before confirming, then showing the final balance.
 */
export function TerminateLeaseDialog(props: ExistingLeaseDialogProps) {
  return (
    <TerminateLeaseDialogBody key={useOpenSession(props.open)} {...props} />
  )
}

function TerminateLeaseDialogBody({
  lease,
  open,
  onOpenChange,
}: ExistingLeaseDialogProps) {
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const locale = useLocale()
  const terminate = useTerminateLease()
  const [endDate, setEndDate] = useState(() => localToday())
  const [result, setResult] = useState<LeaseBalance | null>(null)

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= lease.startDate
  // Unpaid months after the exit are voided, a cut-short last one billed
  // again for the days lived there: what the server will do on confirming.
  const preview = valid
    ? reconciledBalance(
        lease.invoices,
        { ...lease, endDate, terminatedAt: new Date() },
        localToday()
      )
    : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          terminate.reset()
          setResult(null)
          setEndDate(localToday())
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {result ? t("terminatedTitle") : t("terminateTitle")}
          </DialogTitle>
          <DialogDescription>
            {result
              ? t("terminatedDescription", {
                  property: lease.property.name,
                  date: formatDate(endDate, locale),
                })
              : t("terminateDescription", { property: lease.property.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 flex flex-col gap-5">
          {result ? null : (
            <Field>
              <Label htmlFor="terminate-date">{t("fields.exitDate")}</Label>
              <Input
                id="terminate-date"
                type="date"
                min={lease.startDate}
                value={endDate}
                aria-invalid={!valid}
                onChange={(event) => setEndDate(event.target.value)}
              />
              {!valid ? (
                <FieldError>{t("validation.endBeforeStart")}</FieldError>
              ) : null}
            </Field>
          )}

          {result || preview ? (
            <BalanceSummary
              balance={result ?? preview!}
              currency={lease.currency}
              final={Boolean(result)}
            />
          ) : null}

          <DialogFooter className="flex-row justify-end">
            {result ? (
              <Button onClick={() => onOpenChange(false)}>{t("done")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={!valid || terminate.isPending}
                  onClick={() =>
                    terminate.mutate(
                      { id: lease.id, endDate },
                      { onSuccess: (balance) => setResult(balance) }
                    )
                  }
                >
                  {terminate.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {t("terminateSubmit")}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Rent charged, rent received, and what's left, for one lease. */
export function BalanceSummary({
  balance,
  currency,
  final,
  compact,
}: {
  balance: LeaseBalance
  currency: string
  final?: boolean
  /** One row of three figures, for a lease card. */
  compact?: boolean
}) {
  const t = useTranslations("Leases")
  const locale = useLocale()
  const money = (amount: number) => formatMoney(amount, currency, locale)
  const outcome =
    balance.balance > 0
      ? t("balance.owes", { amount: money(balance.balance) })
      : balance.balance < 0
        ? t("balance.refund", { amount: money(-balance.balance) })
        : t("balance.settled")

  if (compact) {
    return (
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-background/70 px-3 py-2">
          <dt className="truncate text-xs text-muted-foreground">
            {t("balance.due")}
          </dt>
          <dd className="truncate tabular-nums">{money(balance.due)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-background/70 px-3 py-2">
          <dt className="truncate text-xs text-muted-foreground">
            {t("balance.paid")}
          </dt>
          <dd className="truncate tabular-nums">{money(balance.paid)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-background/70 px-3 py-2">
          <dt className="truncate text-xs text-muted-foreground">
            {final ? t("balance.final") : t("balance.projected")}
          </dt>
          <dd
            className={cn(
              "truncate font-medium tabular-nums",
              balance.balance > 0
                ? "text-destructive"
                : balance.balance === 0 &&
                    "text-emerald-700 dark:text-emerald-400"
            )}
          >
            {outcome}
          </dd>
        </div>
      </dl>
    )
  }

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-lg border bg-muted/40 p-4 text-sm">
      <dt className="text-muted-foreground">{t("balance.due")}</dt>
      <dd className="text-right tabular-nums">{money(balance.due)}</dd>
      <dt className="text-muted-foreground">{t("balance.paid")}</dt>
      <dd className="text-right tabular-nums">− {money(balance.paid)}</dd>
      <dt className="mt-1.5 border-t pt-2 font-medium">
        {final ? t("balance.final") : t("balance.projected")}
      </dt>
      <dd
        className={cn(
          "mt-1.5 border-t pt-2 text-right font-medium tabular-nums",
          balance.balance > 0 && "text-destructive"
        )}
      >
        {outcome}
      </dd>
    </dl>
  )
}
