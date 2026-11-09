"use client"

import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import { OTPInput } from "@workspace/ui/components/ui/otp-input"
import { Loader2, Mail } from "@workspace/ui/icons"
import { useState } from "react"

import { useSendVerificationEmail, useVerifyEmail } from "@/hooks/queries/user"

const OTP_LENGTH = 6

export function VerifyEmailBanner({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const sendCode = useSendVerificationEmail()
  const verifyEmail = useVerifyEmail()

  function requestCode() {
    sendCode.mutate(email, {
      onSuccess: () => {
        setCode("")
        verifyEmail.reset()
        setOpen(true)
      },
    })
  }

  function verify(otp = code) {
    if (otp.length !== OTP_LENGTH || verifyEmail.isPending) return

    verifyEmail.mutate(
      { email, otp },
      {
        onSuccess: () => setOpen(false),
        onError: () => setCode(""),
      }
    )
  }

  return (
    <>
      <Alert role="status" className="items-center">
        <Mail size={16} />
        <p className="flex-1">
          Verify <span className="font-medium">{email}</span> to secure your
          account.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={sendCode.isPending}
          onClick={requestCode}
        >
          {sendCode.isPending ? <Loader2 className="animate-spin" /> : null}
          Send code
        </Button>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-5">
            <DialogTitle>Check your email</DialogTitle>
            <DialogDescription>
              Enter the {OTP_LENGTH}-digit code we sent to {email}.
            </DialogDescription>
          </DialogHeader>

          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              verify()
            }}
          >
            <OTPInput
              aria-label="Verification code"
              length={OTP_LENGTH}
              value={code}
              onChange={setCode}
              onComplete={verify}
              status={verifyEmail.error ? "error" : "idle"}
              errorMessage={verifyEmail.error?.message}
              disabled={verifyEmail.isPending}
              autoFocus
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={sendCode.isPending}
                onClick={requestCode}
              >
                Resend code
              </Button>
              <Button
                type="submit"
                disabled={code.length !== OTP_LENGTH || verifyEmail.isPending}
              >
                {verifyEmail.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Verify
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
