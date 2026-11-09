"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { TENANT_LIMITS } from "@workspace/api/lease"
import { PASSWORD_MIN_LENGTH } from "@workspace/auth/password"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Field,
  FieldError,
  FieldHeader,
} from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { PasswordStrength } from "@workspace/ui/components/ui/password-strength"
import { Loader2, Plus, RefreshCw, Trash } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"

import type { TenantDetail } from "@/hooks/queries/tenant"
import { useNewPasswordSchema } from "@/hooks/use-new-password-schema"
import { generatePassword } from "@/lib/generate-password"

const PHONE_PATTERN = /^[\d\s()+\-./]*$/

export interface TenantFormValues {
  name: string
  email: string
  password: string
  phone: string
  address: string
  contacts: { name: string; relation: string; email: string; phone: string }[]
}

export const EMPTY_TENANT: TenantFormValues = {
  name: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  contacts: [],
}

/**
 * An existing tenant as form values. A copy keeps the details and contacts
 * but starts a new account, so it gets its own email and password.
 */
export function toTenantFormValues(
  tenant: TenantDetail,
  { copy = false }: { copy?: boolean } = {}
): TenantFormValues {
  return {
    name: tenant.name,
    email: copy ? "" : tenant.email,
    password: "",
    phone: tenant.phone ?? "",
    address: tenant.address ?? "",
    contacts: tenant.contacts.map((contact) => ({
      name: contact.name,
      relation: contact.relation ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
    })),
  }
}

function useTenantSchema(isNew: boolean) {
  const t = useTranslations("Tenants.validation")
  const tValidation = useTranslations("Validation")
  const newPasswordSchema = useNewPasswordSchema()

  return useMemo(() => {
    const text = (max: number) =>
      z.string().trim().max(max, t("tooLong", { max }))
    const optionalEmail = z
      .string()
      .trim()
      .refine((value) => !value || z.email().safeParse(value).success, {
        message: t("emailInvalid"),
      })
    const phone = text(TENANT_LIMITS.phone).regex(PHONE_PATTERN, {
      message: t("phoneInvalid"),
    })

    return z.object({
      name: text(TENANT_LIMITS.name).min(1, t("nameRequired")),
      // The sign-in email and password only matter for a new account.
      email: isNew
        ? z
            .email(tValidation("emailInvalid"))
            .transform((value) => value.toLowerCase())
        : z.string(),
      password: isNew ? newPasswordSchema : z.string(),
      phone,
      address: text(TENANT_LIMITS.address),
      contacts: z
        .array(
          z.object({
            name: text(TENANT_LIMITS.name).min(1, t("contactNameRequired")),
            relation: text(TENANT_LIMITS.relation),
            email: optionalEmail,
            phone,
          })
        )
        .max(TENANT_LIMITS.contacts),
    })
  }, [t, tValidation, newPasswordSchema, isNew])
}

export type TenantFormOutput = z.output<ReturnType<typeof useTenantSchema>>

/**
 * A tenant's sign-in account and what the business records about them. Used
 * to add a tenant (which creates their account), to edit one, and to start a
 * new one from a copy.
 */
export function TenantForm({
  isNew,
  defaultValues,
  submitLabel,
  isPending,
  onSubmit,
}: {
  /** Creates an account, so asks for its email and starting password. */
  isNew: boolean
  defaultValues: TenantFormValues
  submitLabel: string
  isPending: boolean
  onSubmit: (values: TenantFormOutput) => void
}) {
  const t = useTranslations("Tenants")
  const tc = useTranslations("Common")
  const schema = useTenantSchema(isNew)

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const { errors } = form.formState
  const contacts = useFieldArray({ control: form.control, name: "contacts" })

  const optional = (
    <span className="font-normal text-muted-foreground">
      ({tc("optional").toLowerCase()})
    </span>
  )

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      <Field>
        <Label htmlFor="tenant-name">{t("fields.name")}</Label>
        <Input
          id="tenant-name"
          autoComplete="off"
          placeholder={t("placeholders.name")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="tenant-name-error"
          {...form.register("name")}
        />
        <FieldError id="tenant-name-error">{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="tenant-email">{t("fields.email")}</Label>
        <Input
          id="tenant-email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          disabled={!isNew}
          aria-invalid={Boolean(errors.email)}
          aria-describedby="tenant-email-error tenant-email-hint"
          {...form.register("email")}
        />
        <p id="tenant-email-hint" className="text-xs text-muted-foreground">
          {isNew ? t("emailHint") : t("emailLocked")}
        </p>
        <FieldError id="tenant-email-error">{errors.email?.message}</FieldError>
      </Field>

      {isNew ? (
        <Field>
          <FieldHeader>
            <Label htmlFor="tenant-password">{t("fields.password")}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
              onClick={() =>
                form.setValue("password", generatePassword(), {
                  shouldValidate: true,
                })
              }
            >
              <RefreshCw className="size-3" />
              {t("generatePassword")}
            </Button>
          </FieldHeader>
          <PasswordInput
            id="tenant-password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="tenant-password-error tenant-password-hint"
            {...form.register("password")}
          />
          <PasswordStrength
            password={form.watch("password")}
            minLength={PASSWORD_MIN_LENGTH}
          />
          <p
            id="tenant-password-hint"
            className="text-xs text-muted-foreground"
          >
            {t("passwordHint")}
          </p>
          <FieldError id="tenant-password-error">
            {errors.password?.message}
          </FieldError>
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <Label htmlFor="tenant-phone">
            {t("fields.phone")} {optional}
          </Label>
          <Input
            id="tenant-phone"
            type="tel"
            autoComplete="off"
            placeholder="+40 721 234 567"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby="tenant-phone-error"
            {...form.register("phone")}
          />
          <FieldError id="tenant-phone-error">
            {errors.phone?.message}
          </FieldError>
        </Field>
        <Field>
          <Label htmlFor="tenant-address">
            {t("fields.address")} {optional}
          </Label>
          <Input
            id="tenant-address"
            autoComplete="off"
            placeholder={t("placeholders.address")}
            aria-invalid={Boolean(errors.address)}
            aria-describedby="tenant-address-error"
            {...form.register("address")}
          />
          <FieldError id="tenant-address-error">
            {errors.address?.message}
          </FieldError>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">
          {t("contactsTitle")}
        </legend>
        {contacts.fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("contactsEmpty")}</p>
        ) : null}
        {contacts.fields.map((field, index) => {
          const fieldErrors = errors.contacts?.[index]
          return (
            <div
              key={field.id}
              className="flex items-start gap-2 rounded-lg border p-3"
            >
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Field>
                  <Label htmlFor={`contact-${index}-name`} className="text-xs">
                    {t("fields.contactName")}
                  </Label>
                  <Input
                    id={`contact-${index}-name`}
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors?.name)}
                    {...form.register(`contacts.${index}.name`)}
                  />
                  <FieldError>{fieldErrors?.name?.message}</FieldError>
                </Field>
                <Field>
                  <Label
                    htmlFor={`contact-${index}-relation`}
                    className="text-xs"
                  >
                    {t("fields.relation")}
                  </Label>
                  <Input
                    id={`contact-${index}-relation`}
                    autoComplete="off"
                    placeholder={t("placeholders.relation")}
                    aria-invalid={Boolean(fieldErrors?.relation)}
                    {...form.register(`contacts.${index}.relation`)}
                  />
                  <FieldError>{fieldErrors?.relation?.message}</FieldError>
                </Field>
                <Field>
                  <Label htmlFor={`contact-${index}-email`} className="text-xs">
                    {t("fields.contactEmail")}
                  </Label>
                  <Input
                    id={`contact-${index}-email`}
                    type="email"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors?.email)}
                    {...form.register(`contacts.${index}.email`)}
                  />
                  <FieldError>{fieldErrors?.email?.message}</FieldError>
                </Field>
                <Field>
                  <Label htmlFor={`contact-${index}-phone`} className="text-xs">
                    {t("fields.phone")}
                  </Label>
                  <Input
                    id={`contact-${index}-phone`}
                    type="tel"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors?.phone)}
                    {...form.register(`contacts.${index}.phone`)}
                  />
                  <FieldError>{fieldErrors?.phone?.message}</FieldError>
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeContact")}
                onClick={() => contacts.remove(index)}
              >
                <Trash size={16} />
              </Button>
            </div>
          )
        })}
        {contacts.fields.length < TENANT_LIMITS.contacts ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              contacts.append({ name: "", relation: "", email: "", phone: "" })
            }
          >
            <Plus size={14} />
            {t("addContact")}
          </Button>
        ) : null}
      </fieldset>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
