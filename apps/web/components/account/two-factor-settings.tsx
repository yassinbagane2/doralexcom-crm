"use client"

import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import { OTPInput } from "@workspace/ui/components/ui/otp-input"
import { Loader2 } from "@workspace/ui/icons"
import { QRCodeSVG } from "qrcode.react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { BackupCodes } from "@/components/account/backup-codes"
import { PasswordConfirmForm } from "@/components/account/password-confirm-form"
import {
  useConfirmTwoFactor,
  useDisableTwoFactor,
  useEnableTwoFactor,
  useGenerateBackupCodes,
} from "@/hooks/queries/two-factor"

const TOTP_LENGTH = 6

/**
 * Each dialog flow, one step at a time. Enabling is the long one: confirm the
 * password, scan and prove the authenticator works, then save backup codes.
 */
type Flow =
  | { kind: "enable"; step: "password" }
  | {
      kind: "enable"
      step: "scan"
      totpURI: string
      backupCodes: string[]
    }
  | { kind: "enable"; step: "codes"; backupCodes: string[] }
  | { kind: "disable" }
  | { kind: "regenerate"; step: "password" }
  | { kind: "regenerate"; step: "codes"; backupCodes: string[] }

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const t = useTranslations("AccountTwoFactor")
  const [flow, setFlow] = useState<Flow | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{t("authenticatorApp")}</span>
        <Badge variant={enabled ? "default" : "outline"}>
          {enabled ? t("on") : t("off")}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {enabled ? (
          <>
            <Button
              variant="outline"
              onClick={() => setFlow({ kind: "regenerate", step: "password" })}
            >
              {t("newBackupCodes")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setFlow({ kind: "disable" })}
            >
              {t("turnOff")}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setFlow({ kind: "enable", step: "password" })}
          >
            {t("setUp")}
          </Button>
        )}
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
    </div>
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
  const t = useTranslations("AccountTwoFactor")

  switch (flow.kind) {
    case "enable":
      if (flow.step === "password") {
        return <EnablePasswordStep onChange={onChange} />
      }
      if (flow.step === "scan") {
        return (
          <ScanStep
            totpURI={flow.totpURI}
            onConfirmed={() =>
              onChange({
                kind: "enable",
                step: "codes",
                backupCodes: flow.backupCodes,
              })
            }
          />
        )
      }
      return (
        <CodesStep
          title={t("saveCodesTitle")}
          codes={flow.backupCodes}
          onDone={onDone}
        />
      )

    case "regenerate":
      if (flow.step === "password") {
        return <RegeneratePasswordStep onChange={onChange} />
      }
      return (
        <CodesStep
          title={t("newCodesTitle")}
          codes={flow.backupCodes}
          onDone={onDone}
        />
      )

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
            onSuccess: ({ totpURI, backupCodes }) =>
              onChange({ kind: "enable", step: "scan", totpURI, backupCodes }),
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
  const secret = new URL(totpURI).searchParams.get("secret")

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

        {secret ? (
          <p className="text-center text-xs text-muted-foreground">
            {t("cantScan")}
            <code className="mt-1 block font-mono text-sm break-all text-foreground select-all">
              {secret}
            </code>
          </p>
        ) : null}

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

function CodesStep({
  title,
  codes,
  onDone,
}: {
  title: string
  codes: string[]
  onDone: () => void
}) {
  const t = useTranslations("AccountTwoFactor")

  return (
    <>
      <StepHeader title={title} description={t("codesDescription")} />
      <div className="flex flex-col gap-5">
        <BackupCodes codes={codes} />
        <Button onClick={onDone}>{t("savedThem")}</Button>
      </div>
    </>
  )
}

function RegeneratePasswordStep({
  onChange,
}: {
  onChange: (flow: Flow) => void
}) {
  const t = useTranslations("AccountTwoFactor")
  const generate = useGenerateBackupCodes()

  return (
    <>
      <StepHeader
        title={t("regenerateTitle")}
        description={t("regenerateDescription")}
      />
      <PasswordConfirmForm
        submitLabel={t("generateCodes")}
        isPending={generate.isPending}
        onSubmit={(password) =>
          generate.mutate(password, {
            onSuccess: ({ backupCodes }) =>
              onChange({ kind: "regenerate", step: "codes", backupCodes }),
          })
        }
      />
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
