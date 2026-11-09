"use client"

import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import { DialogClose } from "@workspace/ui/components/ui/dialog"
import { Field } from "@workspace/ui/components/ui/field"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { Loader2 } from "@workspace/ui/icons"
import { useId, useState } from "react"

/**
 * Re-enter-your-password step for sensitive actions, meant for a dialog body.
 * The server makes the real check; this only collects the password.
 */
export function PasswordConfirmForm({
  submitLabel,
  destructive = false,
  isPending,
  error,
  onSubmit,
}: {
  submitLabel: string
  destructive?: boolean
  isPending: boolean
  error: Error | null
  onSubmit: (password: string) => void
}) {
  const id = useId()
  const [password, setPassword] = useState("")

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (password) onSubmit(password)
      }}
    >
      {error ? <Alert variant="destructive">{error.message}</Alert> : null}

      <Field>
        <Label htmlFor={id}>Password</Label>
        <PasswordInput
          id={id}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DialogClose render={<Button type="button" variant="ghost" />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          variant={destructive ? "destructive" : "default"}
          disabled={!password || isPending}
        >
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
