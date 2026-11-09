"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  newPasswordSchema,
  PASSWORD_MIN_LENGTH,
} from "@workspace/auth/password"
import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { OTPInput } from "@workspace/ui/components/ui/otp-input"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { PasswordStrength } from "@workspace/ui/components/ui/password-strength"
import { toast } from "@workspace/ui/components/ui/sonner"
import { Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { AuthHeader } from "@/components/auth/auth-header"
import { routes } from "@/config/routes"
import { useRequestPasswordReset, useResetPassword } from "@/hooks/queries/auth"

const OTP_LENGTH = 6

/**
 * Two steps on one page: ask for the email, then take the emailed code and the
 * new password together, so the code is checked and spent in a single request.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState<string | null>(null)

  if (email) {
    return <ResetPasswordStep email={email} onRestart={() => setEmail(null)} />
  }

  return <RequestCodeStep onSent={setEmail} />
}

const requestSchema = z.object({
  email: z.email("Enter a valid email address"),
})

function RequestCodeStep({ onSent }: { onSent: (email: string) => void }) {
  const requestReset = useRequestPasswordReset()

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  })
  const { errors } = form.formState

  function onSubmit({ email }: z.infer<typeof requestSchema>) {
    const normalized = email.toLowerCase()
    requestReset.mutate(normalized, { onSuccess: () => onSent(normalized) })
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Reset your password"
        description="Enter the email you signed up with and we'll send you a code."
      />

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {requestReset.error ? (
          <Alert variant="destructive">{requestReset.error.message}</Alert>
        ) : null}

        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby="email-error"
            {...form.register("email")}
          />
          <FieldError id="email-error">{errors.email?.message}</FieldError>
        </Field>

        <Button type="submit" size="lg" disabled={requestReset.isPending}>
          {requestReset.isPending ? <Loader2 className="animate-spin" /> : null}
          Send code
        </Button>
      </form>

      <BackToSignIn />
    </div>
  )
}

const resetSchema = z.object({
  otp: z.string().length(OTP_LENGTH, "Enter the 6-digit code"),
  password: newPasswordSchema,
})

type ResetValues = z.infer<typeof resetSchema>

function ResetPasswordStep({
  email,
  onRestart,
}: {
  email: string
  onRestart: () => void
}) {
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
          toast.success("Password reset. Sign in with your new password.")
          router.replace(routes.signIn)
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Check your email"
        description={
          <>
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email}</span>, we
            sent it a {OTP_LENGTH}-digit code.
          </>
        }
      />

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {resetPassword.error ? (
          <Alert variant="destructive">{resetPassword.error.message}</Alert>
        ) : null}

        <Controller
          control={form.control}
          name="otp"
          render={({ field }) => (
            <OTPInput
              label="Code"
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
          <Label htmlFor="password">New password</Label>
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
          Reset password
        </Button>

        <Button type="button" variant="ghost" onClick={onRestart}>
          Use a different email
        </Button>
      </form>
    </div>
  )
}

function BackToSignIn() {
  return (
    <p className="text-center text-sm text-muted-foreground">
      Remembered it?{" "}
      <Link
        href={routes.signIn}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </p>
  )
}
