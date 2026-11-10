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
    <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/8 p-4 dark:bg-destructive/12">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-destructive">{t("title")}</h3>
        <p className="text-sm leading-relaxed text-pretty text-destructive/90">
          {t("dialogDescription")}
        </p>
      </div>

      <Dialog onOpenChange={(open) => !open && deleteAccount.reset()}>
        <DialogTrigger
          render={<Button variant="destructive" className="self-start" />}
        >
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
    </div>
  )
}
