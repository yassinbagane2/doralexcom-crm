"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  hasLegalIdentifiers,
  ORGANIZATION_TYPES,
  type OrganizationType,
} from "@workspace/auth/organization"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { RadioCard, RadioGroup } from "@workspace/ui/components/ui/radio-group"
import {
  BuildingOffice,
  Landmark,
  Loader2,
  UserCircle,
} from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import type { OrganizationInput } from "@/hooks/queries/organization"

/** Romanian fiscal code: optional "RO" (VAT payers), then 2–10 digits. */
const TAX_ID_PATTERN = /^(RO)?\d{2,10}$/

const TYPE_ICONS = {
  personal: <UserCircle size={20} />,
  business: <BuildingOffice size={20} />,
  institution: <Landmark className="size-5" strokeWidth={1.75} />,
} satisfies Record<OrganizationType, React.ReactNode>

export interface OrganizationFormValues {
  type: OrganizationType
  name: string
  taxId: string
  registrationNumber: string
}

function useOrganizationSchema() {
  const t = useTranslations("Organization.validation")

  return useMemo(
    () =>
      z
        .object({
          type: z.enum(ORGANIZATION_TYPES),
          name: z
            .string()
            .trim()
            .min(1, t("nameRequired"))
            .max(100, t("nameTooLong")),
          taxId: z
            .string()
            .transform((value) => value.replace(/\s+/g, "").toUpperCase()),
          registrationNumber: z
            .string()
            .trim()
            .max(32, t("registrationNumberTooLong")),
        })
        .superRefine((values, ctx) => {
          if (
            hasLegalIdentifiers(values.type) &&
            values.taxId &&
            !TAX_ID_PATTERN.test(values.taxId)
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["taxId"],
              message: t("taxIdInvalid"),
            })
          }
        }),
    [t]
  )
}

/** Personal landlords don't carry company identifiers; only businesses register. */
function toInput(values: OrganizationFormValues): OrganizationInput {
  const legal = hasLegalIdentifiers(values.type)

  return {
    type: values.type,
    name: values.name,
    taxId: legal ? values.taxId : "",
    registrationNumber:
      values.type === "business" ? values.registrationNumber : "",
  }
}

/**
 * Who the organization is: a person renting out their own property, a
 * company, or a public/non-profit institution. Used by onboarding to create
 * the organization and by settings to edit it.
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
  const type = form.watch("type")
  const legal = hasLegalIdentifiers(type)

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => onSubmit(toInput(values)))}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">{t("typeLegend")}</legend>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <RadioGroup<OrganizationType>
              value={field.value}
              onValueChange={(value) => field.onChange(value)}
              className="gap-2 sm:grid-cols-3"
            >
              {ORGANIZATION_TYPES.map((option) => (
                <RadioCard<OrganizationType>
                  key={option}
                  value={option}
                  className="gap-2 p-4"
                >
                  <span className="text-muted-foreground group-data-checked:text-primary">
                    {TYPE_ICONS[option]}
                  </span>
                  <span className="text-sm font-medium">
                    {t(`types.${option}.title`)}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {t(`types.${option}.description`)}
                  </span>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      <Field>
        <Label htmlFor="organization-name">{t(`nameLabel.${type}`)}</Label>
        <Input
          id="organization-name"
          autoComplete={type === "personal" ? "name" : "organization"}
          placeholder={t(`namePlaceholder.${type}`)}
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
          {t(`nameHint.${type}`)}
        </p>
      </Field>

      {legal ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="organization-tax-id">
              {t(`taxIdLabel.${type}`)}{" "}
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

          {type === "business" ? (
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
          ) : null}
        </div>
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
