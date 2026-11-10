"use client"

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react"
import { EditorContent, useEditorState, type Editor } from "@tiptap/react"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { CM, type PageDimensions } from "./page-geometry"

// The header and footer live in the top and bottom margins of every sheet.
// Their content is shared by all pages: the page being edited hosts the live
// editor and every other page shows a read-only copy of it.

export type RegionKind = "header" | "footer"
export type PageRegion = { page: number; kind: RegionKind }
export type ScreenPoint = { x: number; y: number }

/** Inset of the outline from the sheet edges, in pixels. */
const INSET = 8
/** Height of the tab hanging off the outline. */
const LABEL_HEIGHT = 18
/** Room between a header or footer's text and its outline. */
const OUTLINE_PAD = 4
/** Space kept between a header or footer and the body; the tab sits in it. */
const BODY_GAP = LABEL_HEIGHT + 4
/** Word's default distance from the paper edge to the header or footer. */
const REGION_DISTANCE = 1.25 * CM

/** Where the header, footer and body sit on every sheet, in pixels. */
export type SheetLayout = {
  pageHeight: number
  /** Side margins, shared by the body, the header and the footer. */
  marginLeft: number
  marginRight: number
  /** Paper edge to the header's first line, and to the footer's last line. */
  distance: number
  /** Paper top to the body's first line: the top margin, or more when the header needs it. */
  bodyTop: number
  /** Paper bottom to the body's last line: the bottom margin, or more when the footer needs it. */
  bodyBottom: number
}

export function getSheetLayout(
  dims: PageDimensions,
  headerHeight: number,
  footerHeight: number
): SheetLayout {
  const { top, right, bottom, left } = dims.marginPx
  const distance = Math.min(REGION_DISTANCE, Math.min(top, bottom) / 2)
  const reach = (margin: number, height: number) =>
    height > 0
      ? Math.max(margin, distance + height + OUTLINE_PAD + BODY_GAP)
      : margin
  return {
    pageHeight: dims.heightPx,
    marginLeft: left,
    marginRight: right,
    distance,
    bodyTop: reach(top, headerHeight),
    bodyBottom: reach(bottom, footerHeight),
  }
}

/** The header or footer under `y`, measured in pixels from the top of the first sheet. */
export function regionAt(
  y: number,
  layout: SheetLayout,
  stride: number,
  pageCount: number
): PageRegion | null {
  const page = Math.floor(y / stride)
  if (page < 0 || page >= pageCount) return null
  const offset = y - page * stride
  if (offset < layout.bodyTop) return { page, kind: "header" }
  if (
    offset > layout.pageHeight - layout.bodyBottom &&
    offset < layout.pageHeight
  )
    return { page, kind: "footer" }
  return null
}

export function isSameRegion(a: PageRegion | null, b: PageRegion | null) {
  return a?.page === b?.page && a?.kind === b?.kind
}

/** Puts the caret of `editor` at the text nearest to a screen point. */
export function focusAt(editor: Editor, point: ScreenPoint) {
  const box = editor.view.dom.getBoundingClientRect()
  const found = editor.view.posAtCoords({
    left: Math.min(Math.max(point.x, box.left + 1), box.right - 1),
    top: Math.min(Math.max(point.y, box.top + 1), box.bottom - 1),
  })
  if (found) editor.chain().focus().setTextSelection(found.pos).run()
  else editor.commands.focus("end")
}

/**
 * Height of a header or footer's content. An empty one takes no room
 * unless it is being edited, so an unused header never pushes the body down.
 */
export function useRegionHeight(editor: Editor, editing: boolean) {
  const [height, setHeight] = useState(0)
  const isEmpty = useEditorState({
    editor,
    selector: ({ editor }) => editor.isEmpty,
  })

  useEffect(() => {
    const dom = editor.view.dom
    const measure = () => {
      if (dom.isConnected) setHeight(dom.getBoundingClientRect().height)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(dom)
    return () => observer.disconnect()
  }, [editor])

  return isEmpty && !editing ? 0 : height
}

type PageRegionSlotProps = {
  region: PageRegion
  editor: Editor
  /** Read-only copy of the content, shown when this page does not host the live editor. */
  html: string
  layout: SheetLayout
  stride: number
  /** This page hosts the live editor. */
  live: boolean
  /** The region is being edited. */
  active: boolean
  /** Outline the region (hovered or being edited). */
  outlined: boolean
  disabled: boolean
  showMarks: boolean
  themeVars: CSSProperties
  /** `point` is set when the caret still has to be placed; null when the editor handles the click. */
  onActivate: (region: PageRegion, point: ScreenPoint | null) => void
  onExit: () => void
}

export function PageRegionSlot({
  region,
  editor,
  html,
  layout,
  stride,
  live,
  active,
  outlined,
  disabled,
  showMarks,
  themeVars,
  onActivate,
  onExit,
}: PageRegionSlotProps) {
  const t = useTranslations("Editor.regions")
  const isHeader = region.kind === "header"
  const height = isHeader ? layout.bodyTop : layout.bodyBottom
  const sheetTop = region.page * stride
  const top = isHeader ? sheetTop : sheetTop + layout.pageHeight - height

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return
    // Clicks on the live text are left to the editor; anywhere else in the margin places the caret.
    const onText = live && editor.view.dom.contains(event.target as Node)
    if (!onText) event.preventDefault()
    onActivate(region, onText ? null : { x: event.clientX, y: event.clientY })
  }

  return (
    <div
      data-region={region.kind}
      className={cn(
        "absolute inset-x-0",
        disabled ? "pointer-events-none" : "pointer-events-auto cursor-text"
      )}
      style={{ top, height }}
      onMouseDown={handleMouseDown}
      onKeyDown={(event) => {
        if (event.key === "Escape") onExit()
      }}
    >
      {outlined && (
        <div
          className="absolute animate-in rounded-lg border border-dashed border-indigo-500 bg-indigo-50/80 duration-150 fade-in"
          style={{
            left: INSET,
            right: INSET,
            top: isHeader ? INSET : BODY_GAP,
            bottom: isHeader ? BODY_GAP : INSET,
          }}
        >
          <span
            className={cn(
              "absolute left-2 bg-indigo-100 px-1.5 font-mono text-[11px] text-indigo-950",
              isHeader ? "top-full rounded-b-md" : "bottom-full rounded-t-md"
            )}
            style={{ height: LABEL_HEIGHT, lineHeight: `${LABEL_HEIGHT}px` }}
          >
            {t(isHeader ? "header" : "footer")}
          </span>
        </div>
      )}
      <div
        data-active={active}
        data-show-marks={showMarks}
        className="draft-page draft-region absolute"
        style={{
          ...themeVars,
          left: layout.marginLeft,
          right: layout.marginRight,
          ...(isHeader
            ? { top: layout.distance }
            : { bottom: layout.distance }),
        }}
      >
        {live ? (
          <EditorContent editor={editor} />
        ) : (
          // The copy is the editor's own serialisation of the shared content; it never takes input.
          <div
            className="ProseMirror draft-region-copy pointer-events-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  )
}
