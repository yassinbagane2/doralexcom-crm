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
import { Fingerprint, Loader2, Plus, Trash } from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import {
  SettingsCard,
  SettingsCardHeader,
  SettingsCardRows,
  SettingsRow,
} from "@/components/account/settings-section"
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

  const count = passkeys?.length ?? 0

  return (
    <SettingsCard>
      <SettingsCardHeader action={<AddPasskeyDialog />}>
        {isPending ? (
          <span className="block h-4 w-24 animate-pulse rounded bg-muted" />
        ) : (
          t("count", { count })
        )}
      </SettingsCardHeader>

      {count > 0 ? (
        <SettingsCardRows className="border-t border-border/60">
          {passkeys?.map((passkey) => (
            <li key={passkey.id}>
              <SettingsRow
                icon={<Fingerprint />}
                title={
                  <span className="truncate">
                    {passkey.name || t("fallbackName")}
                  </span>
                }
                description={t("addedOn", {
                  date: formatDate(passkey.createdAt, locale),
                })}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
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
              </SettingsRow>
            </li>
          ))}
        </SettingsCardRows>
      ) : isPending ? null : (
        <p className="border-t border-border/60 px-4 py-3 text-sm text-pretty text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </SettingsCard>
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
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus size={16} />
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
