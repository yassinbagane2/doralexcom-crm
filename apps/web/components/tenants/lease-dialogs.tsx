"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { leaseBalance, localToday, TENANT_LIMITS } from "@workspace/api/lease"
import {
  PROPERTY_LIMITS,
  RENT_CURRENCIES,
  type RentCurrency,
} from "@workspace/api/property"
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
import { Loader2 } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { Controller, useForm, type Control } from "react-hook-form"
import { z } from "zod"

import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import { UserAvatar } from "@/components/user-avatar"
import { useProperties, type Property } from "@/hooks/queries/property"
import {
  useAddPayment,
  useCreateLease,
  useTerminateLease,
  useUpdateLease,
  type LeaseBalance,
  type TenantLease,
} from "@/hooks/queries/tenant"
import { formatDate, formatMoney } from "@/lib/format"
import { orpc } from "@/lib/orpc"

/** "1250,50" and "1250.50" both read as 1250.5; blank reads as null. */
function parseAmount(value: string): number | null | typeof Number.NaN {
  const trimmed = value.replace(/\s/g, "")
  if (!trimmed) return null
  const number = Number(trimmed.replace(",", "."))
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : Number.NaN
}

function useAmount() {
  const t = useTranslations("Leases.validation")
  return useMemo(
    () =>
      ({ required, max }: { required: boolean; max: number }) =>
        z.string().transform((value, ctx) => {
          const amount = parseAmount(value)
          if (amount === null) {
            if (!required) return 0
            ctx.addIssue({ code: "custom", message: t("amountRequired") })
            return z.NEVER
          }
          if (Number.isNaN(amount) || amount < 0 || amount > max) {
            ctx.addIssue({ code: "custom", message: t("amountInvalid") })
            return z.NEVER
          }
          if (required && amount === 0) {
            ctx.addIssue({ code: "custom", message: t("amountRequired") })
            return z.NEVER
          }
          return amount
        }),
    [t]
  )
}

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

interface LeaseFormValues {
  propertyId: string
  tenantId: string
  startDate: string
  endDate: string
  rent: string
  currency: RentCurrency
}

type LeaseFormOutput = Omit<LeaseFormValues, "rent"> & { rent: number }

type LeaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
} & (
  | /** From a tenant's page: pick the property. */
    { tenantId: string; property?: never; lease?: never }
  /** From the properties page: pick the tenant. */
  | { property: Property; tenantId?: never; lease?: never }
  /** Change an existing lease's dates and rent. */
  | { lease: TenantLease; tenantId?: never; property?: never }
)

/**
 * Creates a lease: a tenant occupying a property from an entry date and
 * optionally until an exit date. Opened from either side, so it asks for
 * whichever of the two isn't given. Editing changes the dates and rent of an
 * existing lease.
 */
export function LeaseDialog(props: LeaseDialogProps) {
  return <LeaseDialogBody key={useOpenSession(props.open)} {...props} />
}

function LeaseDialogBody({
  tenantId,
  property,
  lease,
  open,
  onOpenChange,
}: LeaseDialogProps) {
  const pickProperty = !lease && !property
  const pickTenant = !lease && !tenantId
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const create = useCreateLease()
  const update = useUpdateLease()
  const { data: properties } = useProperties()
  const { data: tenants } = useQuery({
    ...orpc.tenant.list.queryOptions(),
    enabled: pickTenant,
  })
  const amount = useAmount()
  const tv = useTranslations("Leases.validation")

  const schema = useMemo(
    () =>
      z
        .object({
          propertyId: z.string().min(1, tv("propertyRequired")),
          tenantId: z.string().min(1, tv("tenantRequired")),
          startDate: z.iso.date(tv("dateRequired")),
          endDate: z.union([z.literal(""), z.iso.date()]),
          rent: amount({ required: false, max: PROPERTY_LIMITS.rent }),
          currency: z.enum(RENT_CURRENCIES),
        })
        .refine(
          (values) => !values.endDate || values.endDate >= values.startDate,
          { message: tv("endBeforeStart"), path: ["endDate"] }
        ),
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
          // Not edited: the lease keeps its tenant.
          tenantId: "unchanged",
          startDate: lease.startDate,
          endDate: lease.endDate ?? "",
          rent: String(lease.rent),
          currency: lease.currency,
        }
      : {
          propertyId: property?.id ?? "",
          tenantId: tenantId ?? "",
          startDate: localToday(),
          endDate: "",
          // Start from the property's own rent.
          rent: property?.rent != null ? String(property.rent) : "",
          currency: property?.currency ?? "RON",
        },
  })
  const { errors } = form.formState
  const isPending = create.isPending || update.isPending

  const propertyItems = (properties ?? []).map((item) => ({
    value: item.id,
    label: item.name,
    property: item,
  }))
  const tenantItems = (tenants ?? []).map((tenant) => ({
    value: tenant.id,
    label: tenant.name,
    email: tenant.email,
  }))

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
              : pickTenant
                ? t("assignTenantTitle", { property: property!.name })
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
          onSubmit={form.handleSubmit((values) => {
            const terms = {
              startDate: values.startDate,
              endDate: values.endDate || null,
              rent: values.rent,
              currency: values.currency,
            }
            const done = { onSuccess: () => onOpenChange(false) }
            if (lease) update.mutate({ ...terms, id: lease.id }, done)
            else
              create.mutate(
                {
                  ...terms,
                  tenantId: values.tenantId,
                  propertyId: values.propertyId,
                },
                done
              )
          })}
        >
          {pickTenant ? (
            <Field>
              <Label htmlFor="lease-tenant">{t("fields.tenant")}</Label>
              <Controller
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <Select
                    items={tenantItems}
                    value={field.value || null}
                    onValueChange={(value) => value && field.onChange(value)}
                  >
                    <SelectTrigger
                      id="lease-tenant"
                      aria-invalid={Boolean(errors.tenantId)}
                    >
                      <SelectValue placeholder={t("tenantPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantItems.map(({ value, label, email }) => (
                        <SelectItem key={value} value={value}>
                          <UserAvatar
                            name={label}
                            className="size-5 text-[10px]"
                          />
                          {label}
                          <span className="truncate text-xs text-muted-foreground">
                            {email}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {tenants && tenants.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("noTenants")}
                </p>
              ) : null}
              <FieldError>{errors.tenantId?.message}</FieldError>
            </Field>
          ) : null}

          {!pickProperty ? null : (
            <Field>
              <Label htmlFor="lease-property">{t("fields.property")}</Label>
              <Controller
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <Select
                    items={propertyItems}
                    value={field.value || null}
                    onValueChange={(value) => {
                      if (!value) return
                      field.onChange(value)
                      // Start from the property's own rent.
                      const chosen = properties?.find((p) => p.id === value)
                      if (chosen?.rent != null) {
                        form.setValue("rent", String(chosen.rent))
                        form.setValue("currency", chosen.currency)
                      }
                    }}
                  >
                    <SelectTrigger
                      id="lease-property"
                      aria-invalid={Boolean(errors.propertyId)}
                    >
                      <SelectValue placeholder={t("propertyPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyItems.map(({ value, label, property }) => (
                        <SelectItem key={value} value={value}>
                          <PropertyTypeIcon
                            type={property.type}
                            className="text-muted-foreground"
                          />
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {properties && properties.length === 0 ? (
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
              <Label htmlFor="lease-end">
                {t("fields.endDate")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({tc("optional").toLowerCase()})
                </span>
              </Label>
              <Input
                id="lease-end"
                type="date"
                aria-invalid={Boolean(errors.endDate)}
                {...form.register("endDate")}
              />
              <FieldError>{errors.endDate?.message}</FieldError>
            </Field>
          </div>

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

          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {lease
                ? tc("saveChanges")
                : pickTenant
                  ? t("assignTenantSubmit")
                  : t("assignSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
type PaymentDialogProps = {
  lease: TenantLease
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentDialog(props: PaymentDialogProps) {
  return <PaymentDialogBody key={useOpenSession(props.open)} {...props} />
}

function PaymentDialogBody({ lease, open, onOpenChange }: PaymentDialogProps) {
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const tv = useTranslations("Leases.validation")
  const amount = useAmount()
  const addPayment = useAddPayment()

  const schema = useMemo(
    () =>
      z.object({
        amount: amount({ required: true, max: PROPERTY_LIMITS.rent }),
        paidOn: z.iso.date(tv("dateRequired")),
        note: z.string().trim().max(TENANT_LIMITS.paymentNote),
      }),
    [amount, tv]
  )

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: lease.rent > 0 ? String(lease.rent) : "",
      paidOn: localToday(),
      note: "",
    },
  })
  const { errors } = form.formState

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
              property: lease.property.name,
              currency: lease.currency,
            })}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="mt-5 flex flex-col gap-5"
          onSubmit={form.handleSubmit((values) =>
            addPayment.mutate(
              { ...values, leaseId: lease.id },
              { onSuccess: () => onOpenChange(false) }
            )
          )}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <Label htmlFor="payment-amount">
                {t("fields.amount", { currency: lease.currency })}
              </Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(errors.amount)}
                {...form.register("amount")}
              />
              <FieldError>{errors.amount?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="payment-date">{t("fields.paidOn")}</Label>
              <Input
                id="payment-date"
                type="date"
                aria-invalid={Boolean(errors.paidOn)}
                {...form.register("paidOn")}
              />
              <FieldError>{errors.paidOn?.message}</FieldError>
            </Field>
          </div>
          <Field>
            <Label htmlFor="payment-note">
              {t("fields.note")}{" "}
              <span className="font-normal text-muted-foreground">
                ({tc("optional").toLowerCase()})
              </span>
            </Label>
            <Input
              id="payment-note"
              autoComplete="off"
              placeholder={t("notePlaceholder")}
              {...form.register("note")}
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
            <Button type="submit" disabled={addPayment.isPending}>
              {addPayment.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {t("paymentSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Terminate a lease -------------------------------------------------------

/**
 * Ends the lease on an exit date, previewing what the tenant will owe (or be
 * owed) before confirming, then showing the final balance.
 */
export function TerminateLeaseDialog(props: PaymentDialogProps) {
  return (
    <TerminateLeaseDialogBody key={useOpenSession(props.open)} {...props} />
  )
}

function TerminateLeaseDialogBody({
  lease,
  open,
  onOpenChange,
}: PaymentDialogProps) {
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const locale = useLocale()
  const terminate = useTerminateLease()
  const [endDate, setEndDate] = useState(() => localToday())
  const [result, setResult] = useState<LeaseBalance | null>(null)

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= lease.startDate
  const preview = valid
    ? leaseBalance(
        { ...lease, endDate, terminatedAt: new Date() },
        lease.paid,
        endDate
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
}: {
  balance: LeaseBalance
  currency: string
  final?: boolean
}) {
  const t = useTranslations("Leases")
  const locale = useLocale()
  const money = (amount: number) => formatMoney(amount, currency, locale)

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
        {balance.balance > 0
          ? t("balance.owes", { amount: money(balance.balance) })
          : balance.balance < 0
            ? t("balance.refund", { amount: money(-balance.balance) })
            : t("balance.settled")}
      </dd>
    </dl>
  )
}
