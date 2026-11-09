"use client"

import { getUserRole } from "@workspace/auth/roles"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { Loader2 } from "@workspace/ui/icons"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { routes } from "@/config/routes"
import { useRemoveUser, type AdminUser } from "@/hooks/queries/admin"

/** Permanent, so the admin types the email to confirm. */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("AdminUser")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const [confirmation, setConfirmation] = useState("")
  const remove = useRemoveUser(user)
  const isBusiness = getUserRole(user.role) === "business"
  const confirmed = confirmation.trim().toLowerCase() === user.email

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setConfirmation("")
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteTitle", { email: user.email })}</DialogTitle>
          <DialogDescription>
            {isBusiness ? t("deleteBusinessWarning") : t("deleteWarning")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!confirmed) return
            remove.mutate(undefined, {
              onSuccess: () => {
                onOpenChange(false)
                router.replace(routes.adminUsers)
                router.refresh()
              },
            })
          }}
        >
          <Field>
            <Label htmlFor="delete-confirmation">
              {t("deleteConfirmLabel", { email: user.email })}
            </Label>
            <Input
              id="delete-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>
          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!confirmed || remove.isPending}
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("deleteSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
