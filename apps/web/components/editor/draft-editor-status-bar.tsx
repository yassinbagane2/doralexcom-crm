"use client"

import { useEditorState, type Editor } from "@tiptap/react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

type DraftEditorStatusBarProps = {
  editor: Editor
  currentPage: number
  pageCount: number
  /** Shown at the right end, e.g. what the document belongs to. */
  aside?: ReactNode
}

export function DraftEditorStatusBar({
  editor,
  currentPage,
  pageCount,
  aside,
}: DraftEditorStatusBarProps) {
  const t = useTranslations("Editor.status")
  const { words, characters } = useEditorState({
    editor,
    selector: ({ editor }) => ({
      words: editor.storage.characterCount.words() as number,
      characters: editor.storage.characterCount.characters() as number,
    }),
  })

  return (
    <footer className="flex h-10 shrink-0 items-center gap-4 border-t px-4 text-sm text-foreground">
      <div className="flex items-center gap-4" aria-live="polite">
        <span>
          {t.rich("page", {
            current: Math.min(currentPage, pageCount),
            count: pageCount,
            strong: (chunks) => <span className="font-semibold">{chunks}</span>,
          })}
        </span>
        <Tooltip>
          <TooltipTrigger render={<span className="cursor-default" />}>
            {t("words", { count: words })}
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {t("characters", { count: characters })}
          </TooltipContent>
        </Tooltip>
      </div>
      {aside ? (
        <div className="ml-auto min-w-0 truncate text-muted-foreground">
          {aside}
        </div>
      ) : null}
    </footer>
  )
}
