"use client"

import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { OTPInput } from "@workspace/ui/components/ui/otp-input"
import { Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AuthHeader } from "@/components/auth/auth-header"
import { routes } from "@/config/routes"
import { useVerifyTwoFactor } from "@/hooks/queries/auth"

const TOTP_LENGTH = 6

type Method = "totp" | "backup-code"

const COPY: Record<Method, { title: string; description: string }> = {
  totp: {
    title: "Two-factor authentication",
    description: "Enter the 6-digit code from your authenticator app.",
  },
  "backup-code": {
    title: "Use a backup code",
    description:
      "Enter one of the backup codes you saved when you turned on two-factor authentication. Each code works once.",
  },
}

export function TwoFactorForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const verify = useVerifyTwoFactor()

  const [method, setMethod] = useState<Method>("totp")
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)

  function submit(value = code) {
    if (!value || verify.isPending) return

    verify.mutate(
      { method, code: value.trim(), trustDevice },
      {
        onSuccess: () => {
          router.replace(redirectTo)
          router.refresh()
        },
        // A wrong TOTP code is cleared so the next attempt starts fresh.
        onError: () => {
          if (method === "totp") setCode("")
        },
      }
    )
  }

  function switchMethod() {
    setMethod((current) => (current === "totp" ? "backup-code" : "totp"))
    setCode("")
    verify.reset()
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title={COPY[method].title}
        description={COPY[method].description}
      />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex flex-col gap-5"
      >
        {verify.error ? (
          <Alert variant="destructive">{verify.error.message}</Alert>
        ) : null}

        {method === "totp" ? (
          <OTPInput
            aria-label="Authentication code"
            length={TOTP_LENGTH}
            value={code}
            onChange={setCode}
            // Submits on the sixth digit; no need to reach for the button.
            onComplete={submit}
            status={verify.error ? "error" : "idle"}
            disabled={verify.isPending}
            autoFocus
          />
        ) : (
          <Field>
            <Label htmlFor="backup-code">Backup code</Label>
            <Input
              id="backup-code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoFocus
            />
          </Field>
        )}

        <Label htmlFor="trust-device" className="font-normal">
          <Checkbox
            id="trust-device"
            checked={trustDevice}
            onCheckedChange={setTrustDevice}
          />
          Trust this device for 30 days
        </Label>

        <Button
          type="submit"
          size="lg"
          disabled={verify.isPending || code.trim() === ""}
        >
          {verify.isPending ? <Loader2 className="animate-spin" /> : null}
          Verify
        </Button>

        <Button type="button" variant="ghost" onClick={switchMethod}>
          {method === "totp"
            ? "Use a backup code instead"
            : "Use your authenticator app instead"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={routes.signIn}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
