"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PASSWORD_MIN_LENGTH } from "@workspace/auth/password"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { PasswordStrength } from "@workspace/ui/components/ui/password-strength"
import { Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { DEFAULT_SIGNED_IN_ROUTE, routes } from "@/config/routes"
import { useSignUp } from "@/hooks/queries/auth"
import { useNewPasswordSchema } from "@/hooks/use-new-password-schema"

function useSignUpSchema() {
  const t = useTranslations("Validation")
  const passwordSchema = useNewPasswordSchema()

  return useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(64, t("nameTooLong")),
        email: z.email(t("emailInvalid")),
        password: passwordSchema,
      }),
    [t, passwordSchema]
  )
}

type SignUpValues = z.infer<ReturnType<typeof useSignUpSchema>>

export function SignUpForm() {
  const t = useTranslations("SignUp")
  const tShared = useTranslations("AuthShared")
  const tValidation = useTranslations("Validation")
  const signUpSchema = useSignUpSchema()
  const router = useRouter()
  const signUp = useSignUp()

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  })
  const { errors } = form.formState

  function onSubmit(values: SignUpValues) {
    signUp.mutate(
      { ...values, email: values.email.toLowerCase() },
      {
        // Signed in straight away; the account page asks for the email code.
        onSuccess: () => {
          router.replace(DEFAULT_SIGNED_IN_ROUTE)
          router.refresh()
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <Field>
          <Label htmlFor="name">{t("nameLabel")}</Label>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby="name-error"
            {...form.register("name")}
          />
          <FieldError id="name-error">{errors.name?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="email">{tShared("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={tShared("emailPlaceholder")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby="email-error"
            {...form.register("email")}
          />
          <FieldError id="email-error">{errors.email?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="password">{tShared("passwordLabel")}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-error password-hint"
            {...form.register("password")}
          />
          <PasswordStrength
            password={form.watch("password")}
            minLength={PASSWORD_MIN_LENGTH}
          />
          <FieldError id="password-error">
            {errors.password?.message}
          </FieldError>
          <p id="password-hint" className="text-xs text-muted-foreground">
            {tValidation("passwordHint", { min: PASSWORD_MIN_LENGTH })}
          </p>
        </Field>

        <Button type="submit" size="lg" disabled={signUp.isPending}>
          {signUp.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t.rich("haveAccount", {
          link: (chunks) => (
            <Link
              href={routes.signIn}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  )
}
