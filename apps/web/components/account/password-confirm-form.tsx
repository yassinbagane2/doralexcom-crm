"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { DialogClose } from "@workspace/ui/components/ui/dialog"
import { Field } from "@workspace/ui/components/ui/field"
import { Label } from "@workspace/ui/components/ui/label"
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

/**
 * Re-enter-your-password step for sensitive actions, meant for a dialog body.
 * The server makes the real check; this only collects the password.
 */
export function PasswordConfirmForm({
  submitLabel,
  destructive = false,
  isPending,
  onSubmit,
}: {
  submitLabel: string
  destructive?: boolean
  isPending: boolean
  onSubmit: (password: string) => void
}) {
  const t = useTranslations("AccountPasswordConfirm")
  const tCommon = useTranslations("Common")
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
      <Field>
        <Label htmlFor={id}>{t("password")}</Label>
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
          {tCommon("cancel")}
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
