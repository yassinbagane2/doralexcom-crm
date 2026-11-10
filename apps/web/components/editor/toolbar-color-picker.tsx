"use client"

import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover"
import { Button } from "@workspace/ui/components/ui/button"
import { cn } from "@workspace/ui/lib/utils"
import { keepEditorFocus, ToolbarMenuButton } from "./toolbar-primitives"
import type { ColorSwatch } from "./document-options"

/**
 * Text colour / highlight picker: an icon with a bar showing the current
 * colour, opening a swatch grid with a custom colour input and a reset.
 */
export function ColorPicker({
  label,
  icon,
  swatches,
  value,
  fallback,
  clearLabel,
  columns = 6,
  disabled,
  onSelect,
  onClear,
}: {
  label: string
  icon: ReactNode
  swatches: readonly ColorSwatch[]
  value: string | undefined
  /** Colour shown on the bar (and in the custom input) when none is applied. */
  fallback: string
  clearLabel: string
  columns?: number
  disabled: boolean
  onSelect: (color: string) => void
  onClear: () => void
}) {
  const t = useTranslations("Editor.toolbar")
  const [open, setOpen] = useState(false)
  const bar = value ?? fallback

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton label={label}>
            <span className="flex flex-col items-center gap-px">
              {icon}
              <span
                aria-hidden="true"
                className="h-[3px] w-4 rounded-full"
                style={{ backgroundColor: bar }}
              />
            </span>
          </ToolbarMenuButton>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        finalFocus={keepEditorFocus}
        className="w-auto rounded-xl p-3"
      >
        <SwatchGrid
          swatches={swatches}
          value={value}
          columns={columns}
          onSelect={(color) => {
            onSelect(color)
            setOpen(false)
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="color"
              aria-label={t("customColor", { label })}
              value={bar}
              onChange={(event) => onSelect(event.target.value)}
              className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0"
            />
            {t("custom")}
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-md text-xs"
            onClick={() => {
              onClear()
              setOpen(false)
            }}
          >
            {clearLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SwatchGrid({
  swatches,
  value,
  onSelect,
  columns,
}: {
  swatches: readonly ColorSwatch[]
  value?: string
  onSelect: (value: string) => void
  columns: number
}) {
  const t = useTranslations("Editor")
  return (
    <div
      role="listbox"
      aria-label={t("toolbar.colors")}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {swatches.map((swatch) => {
        const selected = value?.toLowerCase() === swatch.value.toLowerCase()
        return (
          <button
            key={swatch.value}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={t(`colors.${swatch.id}` as "colors.black")}
            title={t(`colors.${swatch.id}` as "colors.black")}
            onClick={() => onSelect(swatch.value)}
            className={cn(
              "size-6 cursor-pointer rounded-md border border-border/60 transition-transform hover:scale-110",
              selected && "ring-2 ring-ring ring-offset-1"
            )}
            style={{ backgroundColor: swatch.value }}
          />
        )
      })}
    </div>
  )
}
