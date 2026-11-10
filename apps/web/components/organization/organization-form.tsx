"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  isValidIban,
  LEGAL_STRUCTURES,
  normalizeIban,
  ORGANIZATION_LIMITS,
  type LegalStructure,
} from "@workspace/auth/organization"
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
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import type { OrganizationInput } from "@/hooks/queries/organization"

/** Romanian fiscal code: optional "RO" (VAT payers), then 2–10 digits. */
const TAX_ID_PATTERN = /^(RO)?\d{2,10}$/

export interface OrganizationFormValues {
  name: string
  taxId: string
  registrationNumber: string
  legalStructure: LegalStructure | ""
  address: string
  vatNumber: string
  bankName: string
  iban: string
}

export const EMPTY_ORGANIZATION_VALUES: OrganizationFormValues = {
  name: "",
  taxId: "",
  registrationNumber: "",
  legalStructure: "",
  address: "",
  vatNumber: "",
  bankName: "",
  iban: "",
}

function useOrganizationSchema() {
  const t = useTranslations("Organization.validation")

  return useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(100, t("nameTooLong")),
        taxId: z
          .string()
          .transform((value) => value.replace(/\s+/g, "").toUpperCase())
          .refine((value) => !value || TAX_ID_PATTERN.test(value), {
            message: t("taxIdInvalid"),
          }),
        registrationNumber: z
          .string()
          .trim()
          .max(
            ORGANIZATION_LIMITS.registrationNumber,
            t("registrationNumberTooLong")
          ),
        legalStructure: z.union([z.literal(""), z.enum(LEGAL_STRUCTURES)]),
        address: z
          .string()
          .trim()
          .max(ORGANIZATION_LIMITS.address, t("addressTooLong")),
        vatNumber: z
          .string()
          .transform((value) => value.replace(/\s+/g, "").toUpperCase())
          .pipe(
            z.string().max(ORGANIZATION_LIMITS.vatNumber, t("vatNumberTooLong"))
          ),
        bankName: z
          .string()
          .trim()
          .max(ORGANIZATION_LIMITS.bankName, t("bankNameTooLong")),
        iban: z
          .string()
          .transform(normalizeIban)
          .refine((value) => !value || isValidIban(value), {
            message: t("ibanInvalid"),
          }),
      }),
    [t]
  )
}

/** Every organization is a business; the type is fixed rather than chosen. */
function toInput(
  values: OrganizationFormValues,
  detailed: boolean
): OrganizationInput {
  const { name, taxId, registrationNumber, legalStructure, ...details } = values
  return {
    type: "business",
    name,
    taxId,
    registrationNumber,
    // Once chosen, a structure is changed rather than cleared.
    ...(detailed
      ? { ...details, legalStructure: legalStructure || undefined }
      : {}),
  }
}

/** An optional field's label: the name, then "(optional)" in muted text. */
function OptionalLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: string
}) {
  const tc = useTranslations("Common")
  return (
    <Label htmlFor={htmlFor}>
      {children}{" "}
      <span className="font-normal text-muted-foreground">
        ({tc("optional").toLowerCase()})
      </span>
    </Label>
  )
}

/**
 * The business's legal details. Onboarding asks for the essentials to create
 * the organization; settings (`detailed`) edits everything contracts and
 * receipts print: legal structure, address, VAT number and bank account.
 */
export function OrganizationForm({
  defaultValues,
  submitLabel,
  isPending,
  onSubmit,
  detailed = false,
}: {
  defaultValues: OrganizationFormValues
  submitLabel: string
  isPending: boolean
  onSubmit: (input: OrganizationInput) => void
  detailed?: boolean
}) {
  const t = useTranslations("Organization")
  const schema = useOrganizationSchema()

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const { errors } = form.formState

  const structureItems = LEGAL_STRUCTURES.map((value) => ({
    value,
    label: t(`legalStructures.${value}`),
  }))

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        onSubmit(toInput(values, detailed))
      )}
      className="flex flex-col gap-6"
    >
      <Field>
        <Label htmlFor="organization-name">{t("nameLabel")}</Label>
        <Input
          id="organization-name"
          autoComplete="organization"
          placeholder={t("namePlaceholder")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="organization-name-error organization-name-hint"
          {...form.register("name")}
        />
        <FieldError id="organization-name-error">
          {errors.name?.message}
        </FieldError>
        <p
          id="organization-name-hint"
          className="text-xs text-muted-foreground"
        >
          {t("nameHint")}
        </p>
      </Field>

      {detailed ? (
        <>
          <Field>
            <OptionalLabel htmlFor="organization-legal-structure">
              {t("legalStructureLabel")}
            </OptionalLabel>
            <Controller
              control={form.control}
              name="legalStructure"
              render={({ field }) => (
                <Select
                  items={structureItems}
                  value={field.value || null}
                  onValueChange={(value) =>
                    field.onChange((value as LegalStructure | null) ?? "")
                  }
                >
                  <SelectTrigger id="organization-legal-structure">
                    <SelectValue placeholder={t("legalStructurePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {structureItems.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <OptionalLabel htmlFor="organization-address">
              {t("addressLabel")}
            </OptionalLabel>
            <Input
              id="organization-address"
              autoComplete="street-address"
              placeholder={t("addressPlaceholder")}
              aria-invalid={Boolean(errors.address)}
              aria-describedby="organization-address-error"
              {...form.register("address")}
            />
            <FieldError id="organization-address-error">
              {errors.address?.message}
            </FieldError>
          </Field>
        </>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <OptionalLabel htmlFor="organization-tax-id">
            {t("taxIdLabel")}
          </OptionalLabel>
          <Input
            id="organization-tax-id"
            inputMode="text"
            placeholder="RO12345678"
            aria-invalid={Boolean(errors.taxId)}
            aria-describedby="organization-tax-id-error"
            {...form.register("taxId")}
          />
          <FieldError id="organization-tax-id-error">
            {errors.taxId?.message}
          </FieldError>
        </Field>

        <Field>
          <OptionalLabel htmlFor="organization-registration-number">
            {t("registrationNumberLabel")}
          </OptionalLabel>
          <Input
            id="organization-registration-number"
            placeholder="J40/1234/2020"
            aria-invalid={Boolean(errors.registrationNumber)}
            aria-describedby="organization-registration-number-error"
            {...form.register("registrationNumber")}
          />
          <FieldError id="organization-registration-number-error">
            {errors.registrationNumber?.message}
          </FieldError>
        </Field>

        {detailed ? (
          <Field>
            <OptionalLabel htmlFor="organization-vat-number">
              {t("vatNumberLabel")}
            </OptionalLabel>
            <Input
              id="organization-vat-number"
              placeholder="RO12345678"
              aria-invalid={Boolean(errors.vatNumber)}
              aria-describedby="organization-vat-number-error"
              {...form.register("vatNumber")}
            />
            <FieldError id="organization-vat-number-error">
              {errors.vatNumber?.message}
            </FieldError>
          </Field>
        ) : null}
      </div>

      {detailed ? (
        <fieldset className="flex flex-col gap-5">
          <legend className="mb-1 flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("bankTitle")}</span>
            <span className="text-xs text-muted-foreground">
              {t("bankHint")}
            </span>
          </legend>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Field>
              <OptionalLabel htmlFor="organization-bank-name">
                {t("bankNameLabel")}
              </OptionalLabel>
              <Input
                id="organization-bank-name"
                placeholder={t("bankNamePlaceholder")}
                aria-invalid={Boolean(errors.bankName)}
                aria-describedby="organization-bank-name-error"
                {...form.register("bankName")}
              />
              <FieldError id="organization-bank-name-error">
                {errors.bankName?.message}
              </FieldError>
            </Field>
            <Field>
              <OptionalLabel htmlFor="organization-iban">
                {t("ibanLabel")}
              </OptionalLabel>
              <Input
                id="organization-iban"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder="RO49 AAAA 1B31 0075 9384 0000"
                aria-invalid={Boolean(errors.iban)}
                aria-describedby="organization-iban-error"
                {...form.register("iban")}
              />
              <FieldError id="organization-iban-error">
                {errors.iban?.message}
              </FieldError>
            </Field>
          </div>
        </fieldset>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="self-start"
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
