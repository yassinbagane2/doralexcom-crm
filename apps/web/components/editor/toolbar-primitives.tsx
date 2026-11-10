"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  forwardRef,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react"

import { ChevronDownIcon } from "./editor-icons"

const BASE_BUTTON =
  "text-foreground/80 hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md text-sm font-medium transition-colors outline-none select-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-foreground/80"

const ACTIVE_BUTTON =
  "bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"

/**
 * For the toolbar's menus and popovers: an item picked with the pointer
 * leaves focus in the page it just changed; the keyboard returns to the
 * trigger, as usual.
 */
export const keepEditorFocus = (closeType: string) => closeType === "keyboard"

type ToolbarButtonProps = Omit<ComponentProps<"button">, "children"> & {
  /** Tooltip text and accessible name. */
  label: string
  /** Optional keyboard shortcut shown inside the tooltip. */
  shortcut?: string
  active?: boolean
  /** Keeps the editor selection when clicking (defaults to true for plain buttons). */
  keepFocus?: boolean
  children: ReactNode
}

/** Icon button for the editor toolbar, with a tooltip and a pressed state. */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    {
      label,
      shortcut,
      active = false,
      keepFocus = true,
      className,
      onMouseDown,
      children,
      ...props
    },
    ref
  ) {
    const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
      onMouseDown?.(event)
      // Clicking a toolbar button must not steal the selection from the page.
      if (keepFocus && !event.defaultPrevented) event.preventDefault()
    }

    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              ref={ref}
              type="button"
              aria-label={label}
              aria-pressed={active}
              onMouseDown={handleMouseDown}
              className={cn(
                BASE_BUTTON,
                "size-8",
                active && ACTIVE_BUTTON,
                className
              )}
              {...props}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
          {shortcut ? <kbd className="opacity-60">{shortcut}</kbd> : null}
        </TooltipContent>
      </Tooltip>
    )
  }
)

type ToolbarMenuButtonProps = Omit<ComponentProps<"button">, "children"> & {
  label: string
  active?: boolean
  /** Renders the label inside the pill, next to the chevron. */
  showLabel?: boolean
  /** Gray pill background (used for value pickers such as the font family). */
  pill?: boolean
  children?: ReactNode
}

/**
 * Trigger for dropdowns/popovers in the toolbar: an icon or a value with a
 * small chevron. Pass it as a trigger's `render` element.
 */
export const ToolbarMenuButton = forwardRef<
  HTMLButtonElement,
  ToolbarMenuButtonProps
>(function ToolbarMenuButton(
  {
    label,
    active = false,
    showLabel = false,
    pill = false,
    className,
    children,
    ...props
  },
  ref
) {
  const content = (
    <>
      {children}
      {showLabel ? <span className="truncate">{label}</span> : null}
      <ChevronDownIcon size={12} className="shrink-0 opacity-70" />
    </>
  )
  const buttonProps = {
    ref,
    type: "button" as const,
    "aria-label": showLabel ? undefined : label,
    className: cn(
      BASE_BUTTON,
      pill ? "bg-muted px-2.5 hover:bg-muted/70" : "px-1.5",
      active && ACTIVE_BUTTON,
      className
    ),
    ...props,
  }

  if (showLabel) return <button {...buttonProps}>{content}</button>

  return (
    <Tooltip>
      <TooltipTrigger render={<button {...buttonProps} />}>
        {content}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
})

export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("mx-1 h-6 w-px shrink-0 bg-border", className)}
    />
  )
}

export function ToolbarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  )
}
