"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { Editor } from "@tiptap/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/ui/popover"
import { Button } from "@workspace/ui/components/ui/button"
import { Input } from "@workspace/ui/components/ui/input"
import { LinkIcon } from "./editor-icons"
import { keepEditorFocus, ToolbarButton } from "./toolbar-primitives"

function normaliseUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value
  return `https://${value}`
}

/** Popover to add, edit or remove the link under the selection. */
export function LinkControl({
  editor,
  current,
  disabled,
}: {
  editor: Editor
  /** Href of the link under the selection, or null. */
  current: string | null
  disabled: boolean
}) {
  const t = useTranslations("Editor.link")
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState("")

  const onOpenChange = (next: boolean) => {
    if (next) setHref(current ?? "")
    setOpen(next)
  }

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    setOpen(false)
  }

  const apply = () => {
    const url = normaliseUrl(href)
    if (!url) return removeLink()
    const chain = editor.chain().focus()
    if (editor.state.selection.empty && !current) {
      // Nothing selected: insert the URL itself as the link text.
      chain
        .insertContent({
          type: "text",
          text: url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run()
    } else {
      chain.extendMarkRange("link").setLink({ href: url }).run()
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <ToolbarButton
            label={current ? t("edit") : t("insert")}
            shortcut="⌘K"
            active={current !== null}
            keepFocus={false}
          >
            <LinkIcon />
          </ToolbarButton>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        finalFocus={keepEditorFocus}
        className="w-80 rounded-xl p-3"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
          className="flex flex-col gap-3"
        >
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="draft-link-url"
          >
            {t("to")}
          </label>
          <Input
            id="draft-link-url"
            autoFocus
            placeholder="https://example.com"
            value={href}
            onChange={(event) => setHref(event.target.value)}
          />
          <div className="flex items-center justify-end gap-2">
            {current ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-md"
                onClick={removeLink}
              >
                {t("remove")}
              </Button>
            ) : null}
            <Button type="submit" size="sm" className="rounded-md">
              {t("apply")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
