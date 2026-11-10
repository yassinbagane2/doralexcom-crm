"use client"

import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import type { ChainedCommands } from "@tiptap/core"
import type { Editor } from "@tiptap/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover"
import { cn } from "@workspace/ui/lib/utils"
import { TableIcon } from "./editor-icons"
import { keepEditorFocus, ToolbarMenuButton } from "./toolbar-primitives"

const GRID_SIZE = 8

const TABLE_ACTIONS: readonly {
  id:
    | "rowAbove"
    | "rowBelow"
    | "columnLeft"
    | "columnRight"
    | "deleteRow"
    | "deleteColumn"
    | "headerRow"
    | "deleteTable"
  run: (chain: ChainedCommands) => ChainedCommands
  destructive?: boolean
}[] = [
  { id: "rowAbove", run: (chain) => chain.addRowBefore() },
  { id: "rowBelow", run: (chain) => chain.addRowAfter() },
  { id: "columnLeft", run: (chain) => chain.addColumnBefore() },
  { id: "columnRight", run: (chain) => chain.addColumnAfter() },
  { id: "deleteRow", run: (chain) => chain.deleteRow() },
  { id: "deleteColumn", run: (chain) => chain.deleteColumn() },
  { id: "headerRow", run: (chain) => chain.toggleHeaderRow() },
  { id: "deleteTable", run: (chain) => chain.deleteTable(), destructive: true },
]

/** Hover-to-size grid for inserting a table, plus row/column actions inside one. */
export function TablePicker({
  editor,
  inTable,
  disabled,
}: {
  editor: Editor
  inTable: boolean
  disabled: boolean
}) {
  const t = useTranslations("Editor.table")
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState({ rows: 0, cols: 0 })

  const run = (command: (chain: ChainedCommands) => ChainedCommands) => {
    command(editor.chain().focus()).run()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton label={t("label")} active={inTable}>
            <TableIcon />
          </ToolbarMenuButton>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        finalFocus={keepEditorFocus}
        className="w-auto rounded-xl p-3"
      >
        <p
          className="mb-2 text-xs font-medium text-muted-foreground"
          aria-live="polite"
        >
          {hover.rows > 0
            ? t("size", { rows: hover.rows, cols: hover.cols })
            : t("insert")}
        </p>
        <div
          role="grid"
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
            const rows = Math.floor(index / GRID_SIZE) + 1
            const cols = (index % GRID_SIZE) + 1
            const lit = rows <= hover.rows && cols <= hover.cols
            return (
              <button
                key={index}
                type="button"
                aria-label={t("insertSize", { rows, cols })}
                onMouseEnter={() => setHover({ rows, cols })}
                onFocus={() => setHover({ rows, cols })}
                onClick={() =>
                  run((chain) =>
                    chain.insertTable({ rows, cols, withHeaderRow: true })
                  )
                }
                className={cn(
                  "size-5 cursor-pointer rounded-sm border transition-colors",
                  lit
                    ? "border-blue-500 bg-blue-500/20"
                    : "border-border bg-muted/40"
                )}
              />
            )
          })}
        </div>
        {inTable ? (
          <div className="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-3 text-xs">
            {TABLE_ACTIONS.map((action) => (
              <TableAction
                key={action.id}
                destructive={action.destructive}
                onClick={() => run(action.run)}
              >
                {t(action.id)}
              </TableAction>
            ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function TableAction({
  destructive,
  onClick,
  children,
}: {
  destructive?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
        destructive && "text-destructive hover:bg-destructive/10"
      )}
    >
      {children}
    </button>
  )
}
