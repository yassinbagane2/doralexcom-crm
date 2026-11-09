"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldHeader,
} from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { Separator } from "@workspace/ui/components/ui/separator"
import { Fingerprint, Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSyncExternalStore } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { REDIRECT_PARAM, routes } from "@/config/routes"
import { usePasskeySignIn, useSignIn } from "@/hooks/queries/auth"

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  // No policy check here: an account made under an older policy must still
  // be able to sign in.
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean(),
})

type SignInValues = z.infer<typeof signInSchema>

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const signIn = useSignIn()
  const passkeySignIn = usePasskeySignIn()
  const supportsPasskeys = useSupportsPasskeys()

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  })
  const { errors } = form.formState

  function finishSignIn() {
    router.replace(redirectTo)
    router.refresh()
  }

  function onSubmit(values: SignInValues) {
    passkeySignIn.reset()
    signIn.mutate(
      { ...values, email: values.email.toLowerCase() },
      {
        onSuccess: (data) => {
          // The password was right, but the account also wants a TOTP code.
          if ("twoFactorRedirect" in data && data.twoFactorRedirect) {
            const params = new URLSearchParams({ [REDIRECT_PARAM]: redirectTo })
            router.push(`${routes.twoFactor}?${params}`)
            return
          }

          finishSignIn()
        },
      }
    )
  }

  function onPasskeySignIn() {
    signIn.reset()
    passkeySignIn.mutate(undefined, { onSuccess: finishSignIn })
  }

  const isPending = signIn.isPending || passkeySignIn.isPending
  const error = signIn.error ?? passkeySignIn.error

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {error ? <Alert variant="destructive">{error.message}</Alert> : null}

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

        <Field>
          <FieldHeader>
            <Label htmlFor="password">Password</Label>
            <Link
              href={routes.forgotPassword}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </FieldHeader>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-error"
            {...form.register("password")}
          />
          <FieldError id="password-error">
            {errors.password?.message}
          </FieldError>
        </Field>

        <Label htmlFor="remember-me" className="font-normal">
          <Checkbox
            id="remember-me"
            checked={form.watch("rememberMe")}
            onCheckedChange={(checked) => form.setValue("rememberMe", checked)}
          />
          Keep me signed in
        </Label>

        <Button type="submit" size="lg" disabled={isPending}>
          {signIn.isPending ? <Loader2 className="animate-spin" /> : null}
          Sign in
        </Button>
      </form>

      {supportsPasskeys ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onPasskeySignIn}
          >
            {passkeySignIn.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Fingerprint size={16} />
            )}
            Sign in with a passkey
          </Button>
        </>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={routes.signUp}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}

const subscribeNever = () => () => {}

/** WebAuthn exists only in the browser, so this is false during SSR. */
function useSupportsPasskeys() {
  return useSyncExternalStore(
    subscribeNever,
    () => typeof window.PublicKeyCredential !== "undefined",
    () => false
  )
}
