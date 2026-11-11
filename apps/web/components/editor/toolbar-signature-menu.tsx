"use client"

import type { Editor } from "@tiptap/react"
import { SIGNER_ROLES } from "@workspace/api/contract"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Signature } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"

import { keepEditorFocus, ToolbarMenuButton } from "./toolbar-primitives"

/**
 * Places a signature field at the caret, for the business or its customer.
 * Sent for signature, the business's fields are signed with its saved
 * signature and the customer signs theirs.
 */
export function SignatureMenu({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const t = useTranslations("Signing")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton
            label={t("insert")}
            showLabel
            pill
            className="h-9 bg-amber-50 px-2.5 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
          >
            <Signature className="size-4" />
          </ToolbarMenuButton>
        }
      />
      <DropdownMenuContent
        align="end"
        finalFocus={keepEditorFocus}
        className="w-64 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("insertTitle")}</DropdownMenuLabel>
          {SIGNER_ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() =>
                editor.chain().focus().insertSignatureField(role).run()
              }
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    role === "landlord" ? "bg-indigo-500" : "bg-amber-500"
                  )}
                />
                {t(`field.${role}`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`insertHint.${role}`)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
