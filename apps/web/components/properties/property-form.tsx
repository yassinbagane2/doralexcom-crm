"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  PROPERTY_LIMITS,
  PROPERTY_TYPES,
  RENT_CURRENCIES,
  type PropertyType,
  type RentCurrency,
} from "@workspace/api/property"
import { Button } from "@workspace/ui/components/ui/button"
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
import { Textarea } from "@workspace/ui/components/ui/textarea"
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import type { Property, PropertyInput } from "@/hooks/queries/property"

export interface PropertyFormValues {
  type: PropertyType
  name: string
  address: string
  surfaceArea: string
  rent: string
  currency: RentCurrency
  phone: string
  doorCode: string
  description: string
}

export const EMPTY_PROPERTY: PropertyFormValues = {
  type: "apartment",
  name: "",
  address: "",
  surfaceArea: "",
  rent: "",
  currency: "RON",
  phone: "",
  doorCode: "",
  description: "",
}

/** An existing property as form values, to edit it or start a copy. */
export function toFormValues(property: Property): PropertyFormValues {
  return {
    type: property.type,
    name: property.name,
    address: property.address,
    surfaceArea: property.surfaceArea?.toString() ?? "",
    rent: property.rent?.toString() ?? "",
    currency: property.currency,
    phone: property.phone ?? "",
    doorCode: property.doorCode ?? "",
    description: property.description ?? "",
  }
}

function usePropertySchema() {
  const t = useTranslations("Properties.validation")

  return useMemo(() => {
    /** "72,5" and "72.5" both read as 72.5; blank means not set. */
    const amount = (max: number) =>
      z
        .string()
        .trim()
        .transform((value, ctx) => {
          if (!value) return null
          const number = Number(value.replace(/\s/g, "").replace(",", "."))
          if (!Number.isFinite(number) || number < 0 || number > max) {
            ctx.addIssue({ code: "custom", message: t("amountInvalid") })
            return z.NEVER
          }
          return Math.round(number * 100) / 100
        })

    const text = (max: number) =>
      z.string().trim().max(max, t("tooLong", { max }))

    return z.object({
      type: z.enum(PROPERTY_TYPES),
      name: text(PROPERTY_LIMITS.name).min(1, t("nameRequired")),
      address: text(PROPERTY_LIMITS.address).min(1, t("addressRequired")),
      surfaceArea: amount(PROPERTY_LIMITS.surfaceArea),
      rent: amount(PROPERTY_LIMITS.rent),
      currency: z.enum(RENT_CURRENCIES),
      phone: text(PROPERTY_LIMITS.phone).regex(/^[\d\s()+\-./]*$/, {
        message: t("phoneInvalid"),
      }),
      doorCode: text(PROPERTY_LIMITS.doorCode),
      description: text(PROPERTY_LIMITS.description),
    }) satisfies z.ZodType<PropertyInput, PropertyFormValues>
  }, [t])
}

/**
 * Everything recorded about a property. Used to add one, to edit one, and to
 * start a new one from a copy of another.
 */
export function PropertyForm({
  defaultValues,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  defaultValues: PropertyFormValues
  submitLabel: string
  isPending: boolean
  onSubmit: (input: PropertyInput) => void
  onCancel?: () => void
}) {
  const t = useTranslations("Properties")
  const tc = useTranslations("Common")
  const schema = usePropertySchema()

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const { errors } = form.formState

  const typeItems = PROPERTY_TYPES.map((value) => ({
    value,
    label: t(`types.${value}`),
  }))
  const currencyItems = RENT_CURRENCIES.map((value) => ({
    value,
    label: value,
  }))
  const optional = (
    <span className="font-normal text-muted-foreground">
      ({tc("optional").toLowerCase()})
    </span>
  )

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-10"
    >
      <FormSection
        title={t("formSections.basics.title")}
        description={t("formSections.basics.description")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="property-type">{t("fields.type")}</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  items={typeItems}
                  value={field.value}
                  onValueChange={(value) =>
                    value && field.onChange(value as PropertyType)
                  }
                >
                  <SelectTrigger id="property-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeItems.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        <PropertyTypeIcon
                          type={value}
                          className="text-muted-foreground"
                        />
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <Label htmlFor="property-name">{t("fields.name")}</Label>
            <Input
              id="property-name"
              autoComplete="off"
              autoFocus={!defaultValues.name}
              placeholder={t("placeholders.name")}
              aria-invalid={Boolean(errors.name)}
              aria-describedby="property-name-error"
              {...form.register("name")}
            />
            <FieldError id="property-name-error">
              {errors.name?.message}
            </FieldError>
          </Field>
        </div>

        <Field>
          <Label htmlFor="property-address">{t("fields.address")}</Label>
          <Input
            id="property-address"
            autoComplete="off"
            placeholder={t("placeholders.address")}
            aria-invalid={Boolean(errors.address)}
            aria-describedby="property-address-error"
            {...form.register("address")}
          />
          <FieldError id="property-address-error">
            {errors.address?.message}
          </FieldError>
        </Field>
      </FormSection>

      <FormSection
        title={t("formSections.rent.title")}
        description={t("formSections.rent.description")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="property-rent">
              {t("fields.rent")} {optional}
            </Label>
            <div className="flex gap-2">
              <Input
                id="property-rent"
                inputMode="decimal"
                autoComplete="off"
                placeholder="2500"
                aria-invalid={Boolean(errors.rent)}
                aria-describedby="property-rent-error property-rent-hint"
                {...form.register("rent")}
              />
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select
                    items={currencyItems}
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
                      {currencyItems.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <p
              id="property-rent-hint"
              className="text-xs text-muted-foreground"
            >
              {t("rentHint")}
            </p>
            <FieldError id="property-rent-error">
              {errors.rent?.message}
            </FieldError>
          </Field>

          <Field>
            <Label htmlFor="property-surface">
              {t("fields.surfaceArea")} {optional}
            </Label>
            <div className="relative">
              <Input
                id="property-surface"
                inputMode="decimal"
                autoComplete="off"
                placeholder="65"
                className="pr-10"
                aria-invalid={Boolean(errors.surfaceArea)}
                aria-describedby="property-surface-error"
                {...form.register("surfaceArea")}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                m²
              </span>
            </div>
            <FieldError id="property-surface-error">
              {errors.surfaceArea?.message}
            </FieldError>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={t("formSections.access.title")}
        description={t("formSections.access.description")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="property-door-code">
              {t("fields.doorCode")} {optional}
            </Label>
            <Input
              id="property-door-code"
              autoComplete="off"
              spellCheck={false}
              placeholder="1234#"
              aria-invalid={Boolean(errors.doorCode)}
              aria-describedby="property-door-code-error"
              {...form.register("doorCode")}
            />
            <FieldError id="property-door-code-error">
              {errors.doorCode?.message}
            </FieldError>
          </Field>

          <Field>
            <Label htmlFor="property-phone">
              {t("fields.phone")} {optional}
            </Label>
            <Input
              id="property-phone"
              type="tel"
              autoComplete="off"
              placeholder="+40 721 234 567"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby="property-phone-error"
              {...form.register("phone")}
            />
            <FieldError id="property-phone-error">
              {errors.phone?.message}
            </FieldError>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={t("formSections.notes.title")}
        description={t("formSections.notes.description")}
      >
        <Field>
          <Label htmlFor="property-description" className="sr-only">
            {t("fields.description")}
          </Label>
          <Textarea
            id="property-description"
            rows={5}
            placeholder={t("placeholders.description")}
            aria-invalid={Boolean(errors.description)}
            aria-describedby="property-description-error"
            {...form.register("description")}
          />
          <FieldError id="property-description-error">
            {errors.description?.message}
          </FieldError>
        </Field>
      </FormSection>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tc("cancel")}
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** A titled group of fields: what it's about on the left, the fields on the right. */
function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}
