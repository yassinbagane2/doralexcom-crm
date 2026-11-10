"use client"

import { useTranslations } from "next-intl"
import { useState, type KeyboardEvent } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { CheckIcon, MinusIcon, PlusIcon } from "./editor-icons"
import {
  keepEditorFocus,
  ToolbarButton,
  ToolbarMenuButton,
} from "./toolbar-primitives"
import {
  DOCUMENT_FONTS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  findFontByValue,
  nextFontSize,
} from "./document-options"

export function FontFamilyMenu({
  label,
  value,
  styleValue,
  disabled,
  onSelect,
}: {
  label: string
  /** The font the text is in: its own, else its style's. */
  value: string
  /** The font the text's style gives it. */
  styleValue: string
  disabled: boolean
  /** Receives null for the style's own font. */
  onSelect: (value: string | null) => void
}) {
  const current = findFontByValue(value)
  const styleFont = findFontByValue(styleValue)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton
            label={label}
            showLabel
            pill
            className="w-44 justify-between"
            style={{ fontFamily: value }}
          />
        }
      />
      <DropdownMenuContent
        align="start"
        finalFocus={keepEditorFocus}
        className="w-56 rounded-xl p-1.5"
      >
        {DOCUMENT_FONTS.map((font) => {
          const selected = font === current
          return (
            <DropdownMenuItem
              key={font.value}
              onClick={() => onSelect(font === styleFont ? null : font.value)}
              className="justify-between rounded-lg py-2"
              style={{ fontFamily: font.value }}
            >
              {font.label}
              {selected ? (
                <CheckIcon size={14} className="text-foreground" />
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Size field with −/+ steppers; typing a value applies it on Enter or blur. */
export function FontSizeControl({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled: boolean
  onChange: (size: number) => void
}) {
  const t = useTranslations("Editor.toolbar")
  const [typed, setTyped] = useState<string | null>(null)

  const commit = () => {
    if (typed === null) return
    const parsed = Number(typed)
    if (
      Number.isFinite(parsed) &&
      parsed >= MIN_FONT_SIZE &&
      parsed <= MAX_FONT_SIZE
    ) {
      onChange(parsed)
    }
    setTyped(null)
  }

  const step = (direction: 1 | -1) => onChange(nextFontSize(value, direction))

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
      event.currentTarget.blur()
    } else if (event.key === "Escape") {
      setTyped(null)
      event.currentTarget.blur()
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault()
      step(event.key === "ArrowUp" ? 1 : -1)
    }
  }

  return (
    <div className="ml-1 flex h-8 items-center rounded-md bg-muted px-0.5">
      <ToolbarButton
        label={t("decreaseFontSize")}
        shortcut="⌘⇧,"
        disabled={disabled || value <= MIN_FONT_SIZE}
        onClick={() => step(-1)}
        className="size-7 hover:bg-foreground/5"
      >
        <MinusIcon size={14} />
      </ToolbarButton>
      <input
        type="text"
        inputMode="decimal"
        aria-label={t("fontSize")}
        disabled={disabled}
        value={typed ?? String(value)}
        onChange={(event) => setTyped(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="w-9 border-0 bg-transparent p-0 text-center text-sm font-semibold text-foreground tabular-nums outline-none focus:ring-0 disabled:opacity-40"
      />
      <ToolbarButton
        label={t("increaseFontSize")}
        shortcut="⌘⇧."
        disabled={disabled || value >= MAX_FONT_SIZE}
        onClick={() => step(1)}
        className="size-7 hover:bg-foreground/5"
      >
        <PlusIcon size={14} />
      </ToolbarButton>
    </div>
  )
}
