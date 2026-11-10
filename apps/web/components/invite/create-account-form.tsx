"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PASSWORD_MIN_LENGTH } from "@workspace/auth/password"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { PasswordStrength } from "@workspace/ui/components/ui/password-strength"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { inviteRoute, routes } from "@/config/routes"
import {
  useAcceptInvitation,
  useSignUpForInvitation,
} from "@/hooks/queries/invitation"
import { useNewPasswordSchema } from "@/hooks/use-new-password-schema"

function useCreateAccountSchema() {
  const t = useTranslations("Validation")
  const passwordSchema = useNewPasswordSchema()

  return useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(100, t("nameTooLong")),
        password: passwordSchema,
      }),
    [t, passwordSchema]
  )
}

type CreateAccountValues = z.infer<ReturnType<typeof useCreateAccountSchema>>

/**
 * The invitee's new account: their name and a password, for the email the
 * invitation went to. Joining the business follows straight after.
 */
export function CreateAccountForm({
  invitationId,
  email,
  organizationName,
}: {
  invitationId: string
  email: string
  organizationName: string
}) {
  const t = useTranslations("Invitation")
  const tShared = useTranslations("AuthShared")
  const schema = useCreateAccountSchema()
  const router = useRouter()
  const signUp = useSignUpForInvitation()
  const accept = useAcceptInvitation()

  const form = useForm<CreateAccountValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "" },
  })
  const { errors } = form.formState

  function onSubmit(values: CreateAccountValues) {
    signUp.mutate(
      { invitationId, email, ...values },
      {
        onSuccess: () =>
          accept.mutate(invitationId, {
            onSuccess: () => {
              toast.success(t("welcome", { organization: organizationName }))
              router.replace(routes.dashboard)
              router.refresh()
            },
            // The account exists and is signed in: answer from the
            // invitation page, which can retry.
            onError: () => {
              router.replace(inviteRoute(invitationId))
              router.refresh()
            },
          }),
      }
    )
  }

  const isPending = signUp.isPending || accept.isPending

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      <Field>
        <Label htmlFor="email">{tShared("emailLabel")}</Label>
        <Input id="email" type="email" value={email} readOnly disabled />
      </Field>

      <Field>
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input
          id="name"
          autoComplete="name"
          autoFocus
          placeholder={t("namePlaceholder")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="name-error"
          {...form.register("name")}
        />
        <FieldError id="name-error">{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="password">{tShared("passwordLabel")}</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-error"
          {...form.register("password")}
        />
        <PasswordStrength
          password={form.watch("password")}
          minLength={PASSWORD_MIN_LENGTH}
        />
        <FieldError id="password-error">{errors.password?.message}</FieldError>
      </Field>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {t("createAndJoin")}
      </Button>

      <Button
        variant="ghost"
        render={<Link href={inviteRoute(invitationId)} />}
      >
        {t("back")}
      </Button>
    </form>
  )
}
