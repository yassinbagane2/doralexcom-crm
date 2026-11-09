"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { OTPInput } from "@workspace/ui/components/ui/otp-input"
import { Loader2 } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { AuthHeader } from "@/components/auth/auth-header"
import { routes } from "@/config/routes"
import { useVerifyTwoFactor } from "@/hooks/queries/auth"

const TOTP_LENGTH = 6

/** How long a trusted device skips the second step (Better Auth's default). */
const TRUST_DEVICE_DAYS = 30

type Method = "totp" | "backup-code"

export function TwoFactorForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations("TwoFactor")
  const tShared = useTranslations("AuthShared")
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
      {method === "totp" ? (
        <AuthHeader
          title={t("totpTitle")}
          description={t("totpDescription", { length: TOTP_LENGTH })}
        />
      ) : (
        <AuthHeader
          title={t("backupTitle")}
          description={t("backupDescription")}
        />
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex flex-col gap-5"
      >
        {method === "totp" ? (
          <OTPInput
            aria-label={t("codeAriaLabel")}
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
            <Label htmlFor="backup-code">{t("backupCodeLabel")}</Label>
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
          {t("trustDevice", { days: TRUST_DEVICE_DAYS })}
        </Label>

        <Button
          type="submit"
          size="lg"
          disabled={verify.isPending || code.trim() === ""}
        >
          {verify.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("submit")}
        </Button>

        <Button type="button" variant="ghost" onClick={switchMethod}>
          {method === "totp" ? t("useBackupCode") : t("useAuthenticator")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={routes.signIn}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {tShared("backToSignIn")}
        </Link>
      </p>
    </div>
  )
}
