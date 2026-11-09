"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PASSWORD_MIN_LENGTH } from "@workspace/auth/password"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { PasswordStrength } from "@workspace/ui/components/ui/password-strength"
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useChangePassword } from "@/hooks/queries/user"
import { useNewPasswordSchema } from "@/hooks/use-new-password-schema"

type ChangePasswordValues = { currentPassword: string; newPassword: string }

export function ChangePasswordForm() {
  const t = useTranslations("AccountPassword")
  const newPasswordSchema = useNewPasswordSchema()
  const changePassword = useChangePassword()

  const changePasswordSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t("currentRequired")),
          newPassword: newPasswordSchema,
        })
        .refine((values) => values.newPassword !== values.currentPassword, {
          message: t("reused"),
          path: ["newPassword"],
        }),
    [t, newPasswordSchema]
  )

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  })
  const { errors } = form.formState

  function onSubmit(values: ChangePasswordValues) {
    changePassword.mutate(values, { onSuccess: () => form.reset() })
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      <Field>
        <Label htmlFor="current-password">{t("current")}</Label>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.currentPassword)}
          aria-describedby="current-password-error"
          {...form.register("currentPassword")}
        />
        <FieldError id="current-password-error">
          {errors.currentPassword?.message}
        </FieldError>
      </Field>

      <Field>
        <Label htmlFor="new-password">{t("new")}</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword)}
          aria-describedby="new-password-error"
          {...form.register("newPassword")}
        />
        <PasswordStrength
          password={form.watch("newPassword")}
          minLength={PASSWORD_MIN_LENGTH}
        />
        <FieldError id="new-password-error">
          {errors.newPassword?.message}
        </FieldError>
      </Field>

      <Button
        type="submit"
        className="self-start"
        disabled={changePassword.isPending}
      >
        {changePassword.isPending ? <Loader2 className="animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  )
}
