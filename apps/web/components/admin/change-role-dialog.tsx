"use client"

import {
  ASSIGNABLE_ROLES,
  getUserRole,
  type AssignableRole,
} from "@workspace/auth/roles"
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
import { Label } from "@workspace/ui/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select"
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { useSetUserRole, type AdminUser } from "@/hooks/queries/admin"

export function ChangeRoleDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("AdminRole")
  const tCommon = useTranslations("Common")
  const current = getUserRole(user.role)
  const [role, setRole] = useState<AssignableRole>(current)
  const setUserRole = useSetUserRole(user)

  // Start from the account's current role each time the dialog opens, so a
  // cancelled choice doesn't linger and a fresh role change is reflected.
  useEffect(() => {
    if (open) setRole(current)
  }, [open, current])

  const items = ASSIGNABLE_ROLES.map((value) => ({
    value,
    label: t(`roles.${value}`),
  }))
  const unchanged = role === current

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <form
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            setUserRole.mutate(role, { onSuccess: () => onOpenChange(false) })
          }}
        >
          <Field>
            <Label htmlFor="change-role">{t("role")}</Label>
            <Select
              items={items}
              value={role}
              onValueChange={(value) => value && setRole(value as AssignableRole)}
            >
              <SelectTrigger id="change-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(`hints.${role}`)}
            </p>
          </Field>

          {unchanged ? null : (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {current === "admin" ? t("warnings.demoteAdmin") : t(`warnings.${role}`)}
            </div>
          )}

          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={unchanged || setUserRole.isPending}>
              {setUserRole.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
