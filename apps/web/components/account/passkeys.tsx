"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { Loader2, Trash } from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import {
  useAddPasskey,
  useDeletePasskey,
  usePasskeys,
} from "@/hooks/queries/passkey"
import { formatDate } from "@/lib/format"

export function Passkeys() {
  const t = useTranslations("AccountPasskeys")
  const locale = useLocale()
  const { data: passkeys, isPending } = usePasskeys()
  const deletePasskey = useDeletePasskey()

  return (
    <div className="flex flex-col gap-4">
      {isPending ? (
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      ) : passkeys?.length ? (
        <ul className="divide-y rounded-lg border">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {passkey.name || t("fallbackName")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("addedOn", {
                    date: formatDate(passkey.createdAt, locale),
                  })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  passkey.name
                    ? t("remove", { name: passkey.name })
                    : t("removeUnnamed")
                }
                disabled={deletePasskey.isPending}
                onClick={() => deletePasskey.mutate(passkey.id)}
              >
                <Trash size={16} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      <AddPasskeyDialog />
    </div>
  )
}

function AddPasskeyDialog() {
  const t = useTranslations("AccountPasskeys")
  const tCommon = useTranslations("Common")
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const addPasskey = useAddPasskey()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setName("")
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" className="self-start" />}
      >
        {t("add")}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader className="mb-5">
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            addPasskey.mutate(name.trim(), { onSuccess: () => setOpen(false) })
          }}
        >
          <Field>
            <Label htmlFor="passkey-name">{t("nameLabel")}</Label>
            <Input
              id="passkey-name"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {tCommon("cancel")}
            </DialogClose>
            <Button type="submit" disabled={addPasskey.isPending}>
              {addPasskey.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {tCommon("continue")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
