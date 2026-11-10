"use client"

import type { Editor } from "@tiptap/react"
import {
  MERGE_FIELD_GROUPS,
  MERGE_FIELDS,
  mergeFieldGroup,
} from "@workspace/api/contract"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Braces } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"

import { keepEditorFocus, ToolbarMenuButton } from "./toolbar-primitives"

/**
 * Inserts a merge field at the caret: one submenu per thing a contract
 * talks about (landlord, customer, property, lease, the document itself).
 */
export function FieldMenu({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const t = useTranslations("MergeFields")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton
            label={t("insert")}
            showLabel
            pill
            className="h-9 bg-indigo-50 px-2.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
          >
            <Braces className="size-4" />
          </ToolbarMenuButton>
        }
      />
      <DropdownMenuContent
        align="end"
        finalFocus={keepEditorFocus}
        className="w-56 rounded-xl p-1.5"
      >
        {MERGE_FIELD_GROUPS.map((group) => (
          <DropdownMenuSub key={group}>
            <DropdownMenuSubTrigger>
              {t(`groups.${group}`)}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60 rounded-xl p-1.5">
              {MERGE_FIELDS.filter((key) => mergeFieldGroup(key) === group).map(
                (key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() =>
                      editor.chain().focus().insertMergeField(key).run()
                    }
                  >
                    {t(`fields.${key}`)}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
