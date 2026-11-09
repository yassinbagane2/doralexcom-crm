"use client"

import { Alert } from "@workspace/ui/components/ui/alert"
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
  const [flow, setFlow] = useState<Flow | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Authenticator app</span>
        <Badge variant={enabled ? "default" : "outline"}>
          {enabled ? "On" : "Off"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {enabled ? (
          <>
            <Button
              variant="outline"
              onClick={() => setFlow({ kind: "regenerate", step: "password" })}
            >
              New backup codes
            </Button>
            <Button
              variant="ghost"
              onClick={() => setFlow({ kind: "disable" })}
            >
              Turn off
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setFlow({ kind: "enable", step: "password" })}
          >
            Set up
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
          title="Save your backup codes"
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
          title="Your new backup codes"
          codes={flow.backupCodes}
          onDone={onDone}
        />
      )

    case "disable":
      return <DisableStep onDone={onDone} />
  }
}

function EnablePasswordStep({ onChange }: { onChange: (flow: Flow) => void }) {
  const enable = useEnableTwoFactor()

  return (
    <>
      <StepHeader
        title="Set up two-factor authentication"
        description="Confirm your password to continue."
      />
      <PasswordConfirmForm
        submitLabel="Continue"
        isPending={enable.isPending}
        error={enable.error}
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
      <StepHeader
        title="Scan the QR code"
        description="Use an authenticator app such as 1Password, Authy or Google Authenticator, then enter the code it shows."
      />
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
            Can&apos;t scan? Enter this key instead:
            <code className="mt-1 block font-mono text-sm break-all text-foreground select-all">
              {secret}
            </code>
          </p>
        ) : null}

        {confirm.error ? (
          <Alert variant="destructive" className="w-full">
            {confirm.error.message}
          </Alert>
        ) : null}

        <OTPInput
          aria-label="Authentication code"
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
          Turn on
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
  return (
    <>
      <StepHeader
        title={title}
        description="If you lose your authenticator, each code signs you in once. Store them somewhere safe: they won't be shown again."
      />
      <div className="flex flex-col gap-5">
        <BackupCodes codes={codes} />
        <Button onClick={onDone}>I&apos;ve saved them</Button>
      </div>
    </>
  )
}

function RegeneratePasswordStep({
  onChange,
}: {
  onChange: (flow: Flow) => void
}) {
  const generate = useGenerateBackupCodes()

  return (
    <>
      <StepHeader
        title="Generate new backup codes"
        description="Your current backup codes stop working as soon as new ones are generated."
      />
      <PasswordConfirmForm
        submitLabel="Generate codes"
        isPending={generate.isPending}
        error={generate.error}
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
  const disable = useDisableTwoFactor()

  return (
    <>
      <StepHeader
        title="Turn off two-factor authentication?"
        description="Signing in will only need your password or a passkey."
      />
      <PasswordConfirmForm
        submitLabel="Turn off"
        destructive
        isPending={disable.isPending}
        error={disable.error}
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
