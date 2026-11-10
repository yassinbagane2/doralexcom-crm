"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import { OTPInput } from "@workspace/ui/components/motion/otp-input"
import { Loader2, ShieldCheck } from "@workspace/ui/icons"
import { QRCodeSVG } from "qrcode.react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  SettingsCard,
  SettingsIcon,
} from "@/components/account/settings-section"
import { PasswordConfirmForm } from "@/components/account/password-confirm-form"
import { StatusPill } from "@/components/admin/dashboard"
import {
  useConfirmTwoFactor,
  useDisableTwoFactor,
  useEnableTwoFactor,
} from "@/hooks/queries/two-factor"

const TOTP_LENGTH = 6

/**
 * Each dialog flow, one step at a time. Enabling is the long one: confirm the
 * password, then scan and prove the authenticator works.
 */
type Flow =
  | { kind: "enable"; step: "password" }
  | { kind: "enable"; step: "scan"; totpURI: string }
  | { kind: "disable" }

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const t = useTranslations("AccountTwoFactor")
  const [flow, setFlow] = useState<Flow | null>(null)

  return (
    <SettingsCard>
      <div className="flex items-center gap-3 p-4">
        <SettingsIcon>
          <ShieldCheck />
        </SettingsIcon>
        <span className="flex-1 text-base font-semibold">
          {t("authenticatorApp")}
        </span>
        <StatusPill tone={enabled ? "success" : "neutral"}>
          {enabled ? t("on") : t("off")}
        </StatusPill>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setFlow(
              enabled
                ? { kind: "disable" }
                : { kind: "enable", step: "password" }
            )
          }
        >
          {enabled ? t("turnOff") : t("setUp")}
        </Button>
      </div>

      <Dialog
        open={flow !== null}
        onOpenChange={(open) => {
          if (!open) setFlow(null)
        }}
      >
        <DialogContent className="max-w-md">
          {flow ? (
            <FlowStep
              flow={flow}
              onChange={setFlow}
              onDone={() => setFlow(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </SettingsCard>
  )
}

function FlowStep({
  flow,
  onChange,
  onDone,
}: {
  flow: Flow
  onChange: (flow: Flow) => void
  onDone: () => void
}) {
  switch (flow.kind) {
    case "enable":
      if (flow.step === "password") {
        return <EnablePasswordStep onChange={onChange} />
      }
      return <ScanStep totpURI={flow.totpURI} onConfirmed={onDone} />

    case "disable":
      return <DisableStep onDone={onDone} />
  }
}

function EnablePasswordStep({ onChange }: { onChange: (flow: Flow) => void }) {
  const t = useTranslations("AccountTwoFactor")
  const tCommon = useTranslations("Common")
  const enable = useEnableTwoFactor()

  return (
    <>
      <StepHeader
        title={t("enableTitle")}
        description={t("enableDescription")}
      />
      <PasswordConfirmForm
        submitLabel={tCommon("continue")}
        isPending={enable.isPending}
        onSubmit={(password) =>
          enable.mutate(password, {
            onSuccess: ({ totpURI }) =>
              onChange({ kind: "enable", step: "scan", totpURI }),
          })
        }
      />
    </>
  )
}

function ScanStep({
  totpURI,
  onConfirmed,
}: {
  totpURI: string
  onConfirmed: () => void
}) {
  const t = useTranslations("AccountTwoFactor")
  const confirm = useConfirmTwoFactor()
  const [code, setCode] = useState("")

  function submit(value = code) {
    if (value.length !== TOTP_LENGTH || confirm.isPending) return

    confirm.mutate(value, {
      onSuccess: onConfirmed,
      onError: () => setCode(""),
    })
  }

  return (
    <>
      <StepHeader title={t("scanTitle")} description={t("scanDescription")} />
      <form
        noValidate
        className="flex flex-col items-center gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {/* Always on white: scanners struggle with inverted codes. */}
        <div className="rounded-lg border bg-white p-3">
          <QRCodeSVG value={totpURI} size={168} />
        </div>

        <OTPInput
          aria-label={t("codeLabel")}
          length={TOTP_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={submit}
          status={confirm.error ? "error" : "idle"}
          disabled={confirm.isPending}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={code.length !== TOTP_LENGTH || confirm.isPending}
        >
          {confirm.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("turnOn")}
        </Button>
      </form>
    </>
  )
}

function DisableStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations("AccountTwoFactor")
  const disable = useDisableTwoFactor()

  return (
    <>
      <StepHeader
        title={t("disableTitle")}
        description={t("disableDescription")}
      />
      <PasswordConfirmForm
        submitLabel={t("turnOff")}
        destructive
        isPending={disable.isPending}
        onSubmit={(password) => disable.mutate(password, { onSuccess: onDone })}
      />
    </>
  )
}

function StepHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <DialogHeader className="mb-5 pr-8">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  )
}
