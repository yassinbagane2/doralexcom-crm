"use client"

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
import { useState } from "react"

import { useBanUser, type AdminUser } from "@/hooks/queries/admin"
import {
  BAN_DURATIONS,
  BAN_REASONS,
  type BanDuration,
  type BanReason,
} from "@/lib/ban"

const DURATIONS = Object.keys(BAN_DURATIONS) as BanDuration[]

export function BanUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("AdminBan")
  const tCommon = useTranslations("Common")
  const [reason, setReason] = useState<BanReason>(BAN_REASONS[0])
  const [duration, setDuration] = useState<BanDuration>("permanent")
  const ban = useBanUser(user)

  const reasonItems = BAN_REASONS.map((value) => ({
    value,
    label: t(`reasons.${value}`),
  }))
  const durationItems = DURATIONS.map((value) => ({
    value,
    label: t(`durations.${value}`),
  }))

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
            ban.mutate(
              { reason, duration },
              { onSuccess: () => onOpenChange(false) }
            )
          }}
        >
          <Field>
            <Label htmlFor="ban-reason">{t("reason")}</Label>
            <Select
              items={reasonItems}
              value={reason}
              onValueChange={(value) => value && setReason(value as BanReason)}
            >
              <SelectTrigger id="ban-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("reasonHint")}</p>
          </Field>

          <Field>
            <Label htmlFor="ban-duration">{t("duration")}</Label>
            <Select
              items={durationItems}
              value={duration}
              onValueChange={(value) =>
                value && setDuration(value as BanDuration)
              }
            >
              <SelectTrigger id="ban-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("warning")}
          </div>

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
              disabled={ban.isPending}
            >
              {ban.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
