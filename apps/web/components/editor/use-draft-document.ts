"use client"

import type { Editor, JSONContent } from "@tiptap/core"
import {
  fillMergeFields,
  MERGE_FIELDS,
  type DocumentContent,
} from "@workspace/api/contract"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { saveFile, safeFileName } from "@/lib/download"

import { themeById, type DocumentTheme } from "./document-options"
import { buildDocx } from "./docx-export"
import {
  DEFAULT_PAGE_SETUP,
  getPageDimensions,
  toPageSetup,
  type PageDimensions,
  type PageSetup,
} from "./page-geometry"

const regionJson = (region: Editor) =>
  region.isEmpty ? null : (region.getJSON() as DocumentContent["header"])

type HtmlParts = { body: string; header: string | null; footer: string | null }

/**
 * Standalone HTML page for Print, styled with the document theme and printed
 * on the document's page size and margins. The header and footer go in a
 * layout table's thead/tfoot, which browsers repeat at the top and bottom of
 * every printed page.
 */
function renderHtmlFile(
  title: string,
  lang: string,
  theme: DocumentTheme,
  dims: PageDimensions,
  parts: HtmlParts
): string {
  const { top, right, bottom, left } = dims.marginCm
  const textWidthCm = (dims.widthCm - left - right).toFixed(2)
  const main = `<main>\n${parts.body}\n</main>`
  const page =
    parts.header || parts.footer
      ? `<table class="page-layout">
${parts.header ? `<thead><tr><td><header>\n${parts.header}\n</header></td></tr></thead>` : ""}
${parts.footer ? `<tfoot><tr><td><footer>\n${parts.footer}\n</footer></td></tr></tfoot>` : ""}
<tbody><tr><td>${main}</td></tr></tbody>
</table>`
      : main
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
<style>
  @page { size: ${dims.widthCm}cm ${dims.heightCm}cm; margin: ${top}cm ${right}cm ${bottom}cm ${left}cm; }
  body { font-family: ${theme.bodyFont}; font-size: 11pt; line-height: 1.15; color: #1f2937; max-width: ${textWidthCm}cm; margin: ${top}cm auto; }
  @media print { body { max-width: none; margin: 0; } }
  h1, h2, h3, h4 { font-family: ${theme.headingFont}; color: ${theme.accent}; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #9ca3af; padding: 4px 8px; vertical-align: top; }
  img { max-width: 100%; height: auto; }
  .draft-field { background: #e0e7ff; border-radius: 0.25em; color: #3730a3; padding: 0 0.2em; }
  .page-layout > * > tr > td { border: 0; padding: 0; }
  header { padding-bottom: 12pt; }
  footer { padding-top: 12pt; }
</style>
</head>
<body>
${page}
</body>
</html>
`
}

export type DraftDocument = ReturnType<typeof useDraftDocument>

type RegionEditors = { header: Editor; footer: Editor } | null

type UseDraftDocumentOptions = {
  /** The document's name when it opened. */
  initialTitle: string
  /** Layout and theme it was saved with; null for a new document. */
  initialContent: DocumentContent | null
  /** Stores the document. Rejecting keeps it unsaved (the error is shown elsewhere). */
  onSave: (title: string, content: DocumentContent) => Promise<void>
  /** Names a merge field: a template prints and exports these in place of values. */
  fieldLabel: (key: string) => string
  /** Who the Word file says wrote it. */
  creator?: string
  lang: string
  /** Not stored anywhere yet: unsaved from the start. */
  isNew?: boolean
}

/**
 * Everything about the open document besides its text: title, page setup,
 * theme, view settings, and saving, printing and exporting it.
 */
export function useDraftDocument(
  editor: Editor | null,
  regions: RegionEditors,
  {
    initialTitle,
    initialContent,
    onSave,
    fieldLabel,
    creator,
    lang,
    isNew = false,
  }: UseDraftDocumentOptions
) {
  const t = useTranslations("Editor")
  const [title, setTitle] = useState(initialTitle)
  const [dirty, setDirty] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [pageSetup, setPageSetup] = useState<PageSetup>(() =>
    initialContent ? toPageSetup(initialContent.pageSetup) : DEFAULT_PAGE_SETUP
  )
  const [theme, setTheme] = useState<DocumentTheme>(() =>
    themeById(initialContent?.themeId)
  )
  const [showMarks, setShowMarks] = useState(false)
  const [spellcheck, setSpellcheck] = useState(true)
  // The toolbar's pen turns editing off, to read without changing anything.
  const [editable, setEditable] = useState(true)

  // Bumped on every change, so a save that finishes after more typing doesn't mark it clean.
  const revision = useRef(0)
  const markDirty = useCallback(() => {
    revision.current += 1
    setDirty(true)
  }, [])

  // Any content change, in the body or the header and footer, marks the document as unsaved.
  useEffect(() => {
    if (!editor || !regions) return
    const editors = [editor, regions.header, regions.footer]
    for (const instance of editors) instance.on("update", markDirty)
    return () => {
      for (const instance of editors) instance.off("update", markDirty)
    }
  }, [editor, regions, markDirty])

  // Editing off locks the page. No update event: it isn't an edit.
  useEffect(() => {
    for (const instance of [editor, regions?.header, regions?.footer])
      instance?.setEditable(editable, false)
  }, [editor, regions, editable])

  useEffect(() => {
    for (const instance of [editor, regions?.header, regions?.footer])
      if (instance) instance.view.dom.spellcheck = spellcheck
  }, [editor, regions, spellcheck])

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  const renameDocument = useCallback(
    (next: string) => {
      const trimmed = next.trim() || t("untitled")
      if (trimmed === title) return
      setTitle(trimmed)
      markDirty()
    },
    [title, markDirty, t]
  )

  const updatePageSetup = useCallback(
    (patch: Partial<PageSetup>) => {
      setPageSetup((current) => ({ ...current, ...patch }))
      markDirty()
    },
    [markDirty]
  )

  const changeTheme = useCallback(
    (next: DocumentTheme) => {
      setTheme(next)
      markDirty()
    },
    [markDirty]
  )

  /** What is on screen, as stored. */
  const currentContent = useCallback((): DocumentContent | null => {
    if (!editor || !regions) return null
    return {
      version: 1,
      body: editor.getJSON() as DocumentContent["body"],
      header: regionJson(regions.header),
      footer: regionJson(regions.footer),
      pageSetup,
      themeId: theme.id,
    }
  }, [editor, regions, pageSetup, theme])

  const save = useCallback(async () => {
    const content = currentContent()
    if (saving || !content) return
    setSaving(true)
    const startedAt = revision.current
    try {
      await onSave(title, content)
      if (revision.current === startedAt) setDirty(false)
    } catch {
      // The request's own error toast says what went wrong.
    } finally {
      setSaving(false)
    }
  }, [currentContent, saving, onSave, title])

  const downloadDocx = useCallback(async () => {
    const content = currentContent()
    if (!content) return
    // Fields still in the text (a template's) appear by name.
    const labels = Object.fromEntries(
      MERGE_FIELDS.map((key) => [key, `«${fieldLabel(key)}»`])
    )
    const fill = (node: DocumentContent["header"]) =>
      node ? (fillMergeFields(node, labels) as JSONContent) : null
    try {
      const blob = await buildDocx({
        title,
        body: fill(content.body)!,
        header: fill(content.header),
        footer: fill(content.footer),
        pageSetup,
        theme,
        creator,
      })
      saveFile(blob, safeFileName(title, "docx", t("untitled")))
    } catch {
      toast.error(t("exportFailed"))
    }
  }, [currentContent, fieldLabel, title, pageSetup, theme, creator, t])

  // Prints a standalone copy of the document so only the pages, not the app
  // around them, reach the printer.
  const print = useCallback(() => {
    if (!editor || !regions) return
    const html = renderHtmlFile(
      title,
      lang,
      theme,
      getPageDimensions(pageSetup),
      {
        body: editor.getHTML(),
        header: regions.header.isEmpty ? null : regions.header.getHTML(),
        footer: regions.footer.isEmpty ? null : regions.footer.getHTML(),
      }
    )
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
    frame.onload = () => {
      const view = frame.contentWindow
      if (!view) return frame.remove()
      view.addEventListener("afterprint", () => frame.remove())
      view.focus()
      view.print()
    }
    frame.srcdoc = html
    document.body.append(frame)
  }, [editor, regions, title, lang, theme, pageSetup])

  return {
    title,
    renameDocument,
    dirty,
    saving,
    save,
    downloadDocx,
    print,
    pageSetup,
    updatePageSetup,
    theme,
    changeTheme,
    showMarks,
    toggleMarks: () => setShowMarks((value) => !value),
    spellcheck,
    toggleSpellcheck: () => setSpellcheck((value) => !value),
    /** False while the pen is off. */
    editable,
    setEditable,
  }
}
