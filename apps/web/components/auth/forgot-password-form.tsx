"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PASSWORD_MIN_LENGTH } from "@workspace/auth/password"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { OTPInput } from "@workspace/ui/components/motion/otp-input"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { PasswordStrength } from "@workspace/ui/components/ui/password-strength"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { AuthHeader } from "@/components/auth/auth-header"
import { routes } from "@/config/routes"
import { useRequestPasswordReset, useResetPassword } from "@/hooks/queries/auth"
import { useNewPasswordSchema } from "@/hooks/use-new-password-schema"

const OTP_LENGTH = 6

/**
 * Two steps on one page: ask for the email, then take the emailed code and the
 * new password together, so the code is checked and spent in a single request.
 */
export function ForgotPasswordForm({
  initialEmail = "",
  invited = false,
}: {
  /** Prefilled from an invitation link. */
  initialEmail?: string
  /** Opened from a collaborator invitation: choosing a first password. */
  invited?: boolean
}) {
  const [email, setEmail] = useState<string | null>(null)

  if (email) {
    return <ResetPasswordStep email={email} onRestart={() => setEmail(null)} />
  }

  return (
    <RequestCodeStep
      onSent={setEmail}
      initialEmail={initialEmail}
      invited={invited}
    />
  )
}

function useRequestSchema() {
  const t = useTranslations("Validation")

  return useMemo(() => z.object({ email: z.email(t("emailInvalid")) }), [t])
}

type RequestValues = z.infer<ReturnType<typeof useRequestSchema>>

function RequestCodeStep({
  onSent,
  initialEmail,
  invited,
}: {
  onSent: (email: string) => void
  initialEmail: string
  invited: boolean
}) {
  const t = useTranslations("ForgotPassword")
  const tShared = useTranslations("AuthShared")
  const requestSchema = useRequestSchema()
  const requestReset = useRequestPasswordReset()

  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: initialEmail },
  })
  const { errors } = form.formState

  function onSubmit({ email }: RequestValues) {
    const normalized = email.toLowerCase()
    requestReset.mutate(normalized, { onSuccess: () => onSent(normalized) })
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title={invited ? t("invitedTitle") : t("requestTitle")}
        description={
          invited ? t("invitedDescription") : t("requestDescription")
        }
      />

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
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

        <Button type="submit" size="lg" disabled={requestReset.isPending}>
          {requestReset.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("sendCode")}
        </Button>
      </form>

      <BackToSignIn />
    </div>
  )
}

function useResetSchema() {
  const t = useTranslations("Validation")
  const passwordSchema = useNewPasswordSchema()

  return useMemo(
    () =>
      z.object({
        otp: z
          .string()
          .length(OTP_LENGTH, t("codeInvalid", { length: OTP_LENGTH })),
        password: passwordSchema,
      }),
    [t, passwordSchema]
  )
}

type ResetValues = z.infer<ReturnType<typeof useResetSchema>>

function ResetPasswordStep({
  email,
  onRestart,
}: {
  email: string
  onRestart: () => void
}) {
  const t = useTranslations("ForgotPassword")
  const resetSchema = useResetSchema()
  const router = useRouter()
  const resetPassword = useResetPassword()

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: "", password: "" },
  })
  const { errors } = form.formState

  function onSubmit(values: ResetValues) {
    resetPassword.mutate(
      { email, ...values },
      {
        onSuccess: () => {
          toast.success(t("success"))
          router.replace(routes.signIn)
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title={t("checkEmailTitle")}
        description={t.rich("checkEmailDescription", {
          email,
          length: OTP_LENGTH,
          highlight: (chunks) => (
            <span className="font-medium text-foreground">{chunks}</span>
          ),
        })}
      />

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <Controller
          control={form.control}
          name="otp"
          render={({ field }) => (
            <OTPInput
              label={t("codeLabel")}
              aria-label={t("codeLabel")}
              length={OTP_LENGTH}
              value={field.value}
              onChange={field.onChange}
              status={errors.otp ? "error" : "idle"}
              errorMessage={errors.otp?.message}
              autoFocus
            />
          )}
        />

        <Field>
          <Label htmlFor="password">{t("newPasswordLabel")}</Label>
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
          <FieldError id="password-error">
            {errors.password?.message}
          </FieldError>
        </Field>

        <Button type="submit" size="lg" disabled={resetPassword.isPending}>
          {resetPassword.isPending ? (
            <Loader2 className="animate-spin" />
          ) : null}
          {t("submit")}
        </Button>

        <Button type="button" variant="ghost" onClick={onRestart}>
          {t("differentEmail")}
        </Button>
      </form>
    </div>
  )
}

function BackToSignIn() {
  const t = useTranslations("ForgotPassword")

  return (
    <p className="text-center text-sm text-muted-foreground">
      {t.rich("rememberedIt", {
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
  )
}
