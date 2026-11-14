"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover"
import { useState, type ComponentProps, type ReactElement } from "react"

import { NotificationFeed } from "./notifications"

/**
 * The notification feed in a popover, opened from `trigger` (the sidebar's
 * item, or the dock's). Opening a notification closes it.
 */
export function NotificationsPopover({
  trigger,
  side,
  align,
  sideOffset = 8,
  onNavigate,
}: {
  trigger: ReactElement
  onNavigate?: () => void
} & Pick<
  ComponentProps<typeof PopoverContent>,
  "side" | "align" | "sideOffset"
>) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="h-[min(34rem,var(--available-height))] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl p-0"
      >
        <NotificationFeed
          onNavigate={() => {
            setOpen(false)
            onNavigate?.()
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
