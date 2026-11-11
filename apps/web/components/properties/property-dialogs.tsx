"use client"

import { leaseStatus } from "@workspace/api/lease"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import { Loader2 } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { routes } from "@/config/routes"
import { useDeleteProperty } from "@/hooks/queries/property"

interface OccupancyLease {
  startDate: string
  endDate: string | null
  customer: { id: string; name: string; email: string | null }
}

/** Who's in the property today, and who moves in next. */
export function occupancy<L extends OccupancyLease>(
  leases: readonly L[],
  today: string
) {
  let current: L | null = null
  let next: L | null = null
  for (const lease of leases) {
    const status = leaseStatus(lease, today)
    if (status === "active" || status === "ending") current = lease
    else if (status === "upcoming") next ??= lease
  }
  return { current, next }
}

/** A small "Occupied" / "Vacant" pill, with a dot for colour. */
export function OccupancyPill({
  occupied,
  className,
}: {
  occupied: boolean
  className?: string
}) {
  const t = useTranslations("Properties")
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          occupied ? "bg-emerald-500" : "bg-amber-500"
        )}
      />
      {occupied ? t("occupied") : t("vacant")}
    </span>
  )
}

/**
 * Deleting is refused while a lease holds the property, now or later. The
 * server makes the same check (and refuses once rent has been paid on it);
 * this just says so up front and points to the customer.
 */
export function DeletePropertyDialog({
  property,
  today,
  onClose,
  onDeleted,
}: {
  property: { id: string; name: string; leases: OccupancyLease[] } | null
  today: string
  onClose: () => void
  onDeleted?: () => void
}) {
  const t = useTranslations("Properties")
  const tCommon = useTranslations("Common")
  const remove = useDeleteProperty()
  // The dialog keeps its property while it animates closed.
  const [shown, setShown] = useState(property)
  if (property && property !== shown) setShown(property)

  const holder = shown
    ? (() => {
        const { current, next } = occupancy(shown.leases, today)
        return current ?? next
      })()
    : null
  const customer = holder?.customer

  return (
    <Dialog
      open={property !== null}
      onOpenChange={(open) => {
        if (open) return
        onClose()
        remove.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {customer
              ? t("inUseTitle", { name: shown?.name ?? "" })
              : t("deleteTitle", { name: shown?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {customer
              ? t("inUseDescription", { customer: customer.name })
              : t("deleteDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          {customer ? (
            <Button
              render={<Link href={`${routes.customers}/${customer.id}`} />}
            >
              {t("viewCustomerShort")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={remove.isPending || !shown}
              onClick={() =>
                shown &&
                remove.mutate(
                  { id: shown.id },
                  {
                    onSuccess: () => {
                      onClose()
                      onDeleted?.()
                    },
                  }
                )
              }
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("deleteSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
