"use client"

import { useEditor, useEditorState, type JSONContent } from "@tiptap/react"
import { isMergeFieldKey, type DocumentContent } from "@workspace/api/contract"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"
import {
  ArrowLeftIcon,
  Loader2,
  LoaderCircle,
  Printer,
  WordDocument,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { DraftEditorCanvas } from "./draft-editor-canvas"
import { DraftEditorStatusBar } from "./draft-editor-status-bar"
import { DraftEditorToolbar } from "./draft-editor-toolbar"
import { createDraftExtensions } from "./extensions"
import { useSignatureLabels } from "./use-signature-labels"
import { getPageAt, getPageCount } from "./pagination"
import { useDraftDocument, type DraftDocument } from "./use-draft-document"
import { useDraftRegions } from "./use-draft-regions"

const EMPTY_EDITOR_STATE = { pageCount: 1, currentPage: 1 }

export type DocumentEditorProps = {
  /** The document's name when it opened. */
  title: string
  /** What it opens with; null starts a blank page. */
  content: DocumentContent | null
  /** Stores the document. Reject to keep it unsaved. */
  onSave: (title: string, content: DocumentContent) => Promise<void>
  backHref: string
  backLabel: string
  /** A word on what's being edited, shown above the title ("Template"…). */
  eyebrow?: ReactNode
  /** Under the toolbar, e.g. how a template's fields work. */
  banner?: ReactNode
  /** At the right of the status bar. */
  aside?: ReactNode
  /** Whether the toolbar offers merge fields: for templates. */
  fields?: boolean
  placeholder: string
  /** Who the Word file says wrote it. */
  creator?: string
  /** Extra header buttons, before Save. */
  actions?: ReactNode
  /** Not stored anywhere yet. */
  isNew?: boolean
}

export function DocumentEditorLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border bg-card shadow-xs dark:bg-background">
      <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

/**
 * The paged rich text editor (ported from the Deo drafting editor): Word-like
 * pages with rulers, margins, headers and footers, tables and lists. Saving,
 * and what is saved, are the caller's.
 */
export function DocumentEditor({
  title,
  content,
  onSave,
  backHref,
  backLabel,
  eyebrow,
  banner,
  aside,
  fields = false,
  placeholder,
  creator,
  actions,
  isNew,
}: DocumentEditorProps) {
  const locale = useLocale()
  const tf = useTranslations("MergeFields")
  const fieldLabel = useCallback(
    (key: string) => (isMergeFieldKey(key) ? tf(`fields.${key}`) : key),
    [tf]
  )
  // The editors take their content once; later saves don't reload it.
  const [initial] = useState(() => ({
    body: (content?.body as JSONContent | undefined) ?? "",
    header: (content?.header as JSONContent | null | undefined) ?? "",
    footer: (content?.footer as JSONContent | null | undefined) ?? "",
  }))

  const signature = useSignatureLabels()
  const editor = useEditor({
    extensions: createDraftExtensions(placeholder, { fieldLabel, signature }),
    // Pages render on the server; the editor only exists in the browser.
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: initial.body,
  })

  const regions = useDraftRegions(editor, initial, fieldLabel)
  const draft = useDraftDocument(editor, regions.editors, {
    initialTitle: title,
    initialContent: content,
    onSave,
    fieldLabel,
    creator,
    lang: locale,
    isNew,
  })

  // Pages come from the pagination plugin; the current one holds the caret.
  const { pageCount, currentPage } =
    useEditorState({
      editor,
      selector: ({ editor }) =>
        editor
          ? {
              pageCount: getPageCount(editor.state),
              currentPage: getPageAt(editor.state, editor.state.selection.from),
            }
          : EMPTY_EDITOR_STATE,
    }) ?? EMPTY_EDITOR_STATE

  // ⌘S / Ctrl+S saves and ⌘P / Ctrl+P prints the document, instead of the
  // browser's page.
  const { save, print } = draft
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === "s") {
        event.preventDefault()
        void save()
      } else if (key === "p") {
        event.preventDefault()
        print()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save, print])

  if (!editor || !regions.editors) return <DocumentEditorLoading />

  const activeRegion = draft.editable ? regions.active : null

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs dark:bg-background">
      <EditorHeader
        draft={draft}
        backHref={backHref}
        backLabel={backLabel}
        eyebrow={eyebrow}
        actions={actions}
      />
      {/* Formatting applies to whichever of the body, header or footer is being edited. */}
      <DraftEditorToolbar
        key={activeRegion?.kind ?? "body"}
        editor={activeRegion ? regions.editors[activeRegion.kind] : editor}
        draft={draft}
        fields={fields}
      />
      {banner}
      <DraftEditorCanvas
        editor={editor}
        regions={regions}
        regionEditors={regions.editors}
        draft={draft}
        pageCount={pageCount}
      />
      <DraftEditorStatusBar
        editor={editor}
        currentPage={currentPage}
        pageCount={pageCount}
        aside={aside}
      />
    </div>
  )
}

function EditorHeader({
  draft,
  backHref,
  backLabel,
  eyebrow,
  actions,
}: {
  draft: DraftDocument
  backHref: string
  backLabel: string
  eyebrow?: ReactNode
  actions?: ReactNode
}) {
  const t = useTranslations("Editor.header")

  return (
    <TooltipProvider delay={350}>
      <header className="flex shrink-0 items-center gap-3 border-b px-3 py-2.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={backLabel}
                render={<Link href={backHref} />}
              />
            }
          >
            <ArrowLeftIcon isHovered className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">{backLabel}</TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 flex-col">
          {eyebrow ? (
            // Same inset as the title's text, so the two line up.
            <span className="truncate px-1.5 text-xs text-muted-foreground">
              {eyebrow}
            </span>
          ) : null}
          <div className="flex min-w-0 items-center gap-2.5">
            <TitleInput value={draft.title} onCommit={draft.renameDocument} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <SaveState draft={draft} />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("print")}
                  onClick={draft.print}
                />
              }
            >
              <Printer className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("print")} <kbd className="opacity-60">⌘P</kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("downloadWord")}
                  onClick={() => void draft.downloadDocx()}
                />
              }
            >
              <WordDocument className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("downloadWord")}</TooltipContent>
          </Tooltip>
          {actions}
          <Button
            onClick={() => void draft.save()}
            disabled={draft.saving}
            className="ml-1"
          >
            {draft.saving ? <Loader2 className="animate-spin" /> : null}
            {t("save")}
          </Button>
        </div>
      </header>
    </TooltipProvider>
  )
}

/** The document's name, edited in place; Enter or leaving the field keeps it. */
function TitleInput({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const t = useTranslations("Editor.header")
  const [typed, setTyped] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const commit = () => {
    if (typed !== null) onCommit(typed)
    setTyped(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      ref.current?.blur()
    } else if (event.key === "Escape") {
      setTyped(null)
      // Blurring after the reset keeps the old name.
      requestAnimationFrame(() => ref.current?.blur())
    }
  }

  const shown = typed ?? value
  const text =
    "px-1.5 py-0.5 font-heading text-lg leading-7 font-medium tracking-[-0.01em]"

  // The input sits over an invisible copy of its text, which sizes it: as
  // wide as the name (up to the space there is), with the save state after it.
  return (
    <span className="grid min-w-0">
      <span
        aria-hidden="true"
        className={cn(
          text,
          "invisible col-start-1 row-start-1 truncate whitespace-pre"
        )}
      >
        {shown || " "}
      </span>
      <input
        ref={ref}
        value={shown}
        aria-label={t("title")}
        maxLength={200}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cn(
          text,
          "col-start-1 row-start-1 w-full min-w-0 truncate rounded-md bg-transparent outline-none hover:bg-muted focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        )}
      />
    </span>
  )
}

/** Whether the latest edits are stored: a dot and a word, just before Save. */
function SaveState({ draft }: { draft: DraftDocument }) {
  const t = useTranslations("Editor.header")
  const state = draft.saving ? "saving" : draft.dirty ? "unsaved" : "saved"

  return (
    <span
      aria-live="polite"
      className="mr-1 hidden items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground sm:inline-flex"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full transition-colors",
          state === "saved" && "bg-emerald-500",
          state === "unsaved" && "bg-amber-500",
          state === "saving" && "animate-pulse bg-muted-foreground"
        )}
      />
      <span className={cn(state === "unsaved" && "text-foreground")}>
        {t(state)}
      </span>
    </span>
  )
}
