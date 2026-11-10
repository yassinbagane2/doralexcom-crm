"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { OrganizationInput } from "@/hooks/queries/organization"

/** Romanian fiscal code: optional "RO" (VAT payers), then 2–10 digits. */
const TAX_ID_PATTERN = /^(RO)?\d{2,10}$/

export interface OrganizationFormValues {
  name: string
  taxId: string
  registrationNumber: string
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
          .max(32, t("registrationNumberTooLong")),
      }),
    [t]
  )
}

/** Every organization is a business; the type is fixed rather than chosen. */
function toInput(values: OrganizationFormValues): OrganizationInput {
  return { type: "business", ...values }
}

/**
 * The business's legal details. Used by onboarding to create the organization
 * and by settings to edit it.
 */
export function OrganizationForm({
  defaultValues,
  submitLabel,
  isPending,
  onSubmit,
}: {
  defaultValues: OrganizationFormValues
  submitLabel: string
  isPending: boolean
  onSubmit: (input: OrganizationInput) => void
}) {
  const t = useTranslations("Organization")
  const tc = useTranslations("Common")
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

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => onSubmit(toInput(values)))}
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

      <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="organization-tax-id">
              {t("taxIdLabel")}{" "}
              <span className="font-normal text-muted-foreground">
                ({tc("optional").toLowerCase()})
              </span>
            </Label>
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
              <Label htmlFor="organization-registration-number">
                {t("registrationNumberLabel")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({tc("optional").toLowerCase()})
                </span>
              </Label>
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
        </div>

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
