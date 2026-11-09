"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog"
import { useTranslations } from "next-intl"

import { PasswordConfirmForm } from "@/components/account/password-confirm-form"
import { useDeleteAccount } from "@/hooks/queries/user"

export function DeleteAccount() {
  const t = useTranslations("AccountDelete")
  const deleteAccount = useDeleteAccount()

  return (
    <Dialog onOpenChange={(open) => !open && deleteAccount.reset()}>
      <DialogTrigger render={<Button variant="destructive" />}>
        {t("trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-5">
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <PasswordConfirmForm
          submitLabel={t("submit")}
          destructive
          isPending={deleteAccount.isPending}
          onSubmit={(password) => deleteAccount.mutate(password)}
        />
      </DialogContent>
    </Dialog>
  )
}
