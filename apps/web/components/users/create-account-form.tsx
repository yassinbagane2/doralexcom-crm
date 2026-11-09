"use client"

import { zodResolver } from "@hookform/resolvers/zod"
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
import { Loader2, RefreshCw } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useNewPasswordSchema } from "@/hooks/use-new-password-schema"
import { generatePassword } from "@/lib/generate-password"

export interface CreateAccountValues {
  name: string
  email: string
  password: string
}

/**
 * Name, email and a starting password for someone else's account. Shared by
 * the admin creating a business and a business creating a user; the caller
 * decides which role the account gets.
 */
export function CreateAccountForm({
  submitLabel,
  isPending,
  onSubmit,
}: {
  submitLabel: string
  isPending: boolean
  onSubmit: (values: CreateAccountValues) => void
}) {
  const t = useTranslations("CreateAccount")
  const tValidation = useTranslations("Validation")
  const newPasswordSchema = useNewPasswordSchema()

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, tValidation("nameRequired"))
          .max(100, tValidation("nameTooLong")),
        email: z.email(tValidation("emailInvalid")),
        password: newPasswordSchema,
      }),
    [tValidation, newPasswordSchema]
  )

  const form = useForm<CreateAccountValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  })
  const { errors } = form.formState

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        onSubmit({ ...values, email: values.email.toLowerCase() })
      )}
      className="flex flex-col gap-5"
    >
      <Field>
        <Label htmlFor="account-name">{t("name")}</Label>
        <Input
          id="account-name"
          autoComplete="off"
          placeholder={t("namePlaceholder")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="account-name-error"
          {...form.register("name")}
        />
        <FieldError id="account-name-error">{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="account-email">{t("email")}</Label>
        <Input
          id="account-email"
          type="email"
          autoComplete="off"
          placeholder={t("emailPlaceholder")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby="account-email-error"
          {...form.register("email")}
        />
        <FieldError id="account-email-error">
          {errors.email?.message}
        </FieldError>
      </Field>

      <Field>
        <FieldHeader>
          <Label htmlFor="account-password">{t("password")}</Label>
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
            {t("generate")}
          </Button>
        </FieldHeader>
        <PasswordInput
          id="account-password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="account-password-error account-password-hint"
          {...form.register("password")}
        />
        <PasswordStrength
          password={form.watch("password")}
          minLength={PASSWORD_MIN_LENGTH}
        />
        <p id="account-password-hint" className="text-xs text-muted-foreground">
          {t("passwordHint")}
        </p>
        <FieldError id="account-password-error">
          {errors.password?.message}
        </FieldError>
      </Field>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
