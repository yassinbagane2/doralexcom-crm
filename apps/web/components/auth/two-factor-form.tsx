"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
import { Label } from "@workspace/ui/components/ui/label"
import { OTPInput } from "@workspace/ui/components/motion/otp-input"
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

export function TwoFactorForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations("TwoFactor")
  const tShared = useTranslations("AuthShared")
  const router = useRouter()
  const verify = useVerifyTwoFactor()

  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)

  function submit(value = code) {
    if (!value || verify.isPending) return

    verify.mutate(
      { code: value.trim(), trustDevice },
      {
        onSuccess: () => {
          router.replace(redirectTo)
          router.refresh()
        },
        // A wrong code is cleared so the next attempt starts fresh.
        onError: () => setCode(""),
      }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title={t("totpTitle")}
        description={t("totpDescription", { length: TOTP_LENGTH })}
      />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex flex-col gap-5"
      >
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
