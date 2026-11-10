"use client"

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { EditorContent, useEditorState, type Editor } from "@tiptap/react"
import { cn } from "@workspace/ui/lib/utils"
import { themeCssVars } from "./document-options"
import {
  HorizontalRuler,
  VerticalRuler,
  V_RULER_WIDTH,
} from "./draft-editor-ruler"
import { getPageDimensions } from "./page-geometry"
import {
  focusAt,
  getSheetLayout,
  isSameRegion,
  PageRegionSlot,
  regionAt,
  useRegionHeight,
  type PageRegion,
  type RegionKind,
  type ScreenPoint,
} from "./draft-page-regions"
import type { DraftDocument } from "./use-draft-document"
import type { DraftRegions } from "./use-draft-regions"
import "./draft-editor.css"

/** Space between the rulers and the paper, and between two sheets, in pixels. */
const PAGE_GAP = 24
const CANVAS_GUTTER = 24
const REGION_KINDS: RegionKind[] = ["header", "footer"]

/** The read-only copy other pages show of a header or footer. */
function useRegionHtml(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => (editor.isEmpty ? "" : editor.getHTML()),
  })
}

type DraftEditorCanvasProps = {
  editor: Editor
  regions: DraftRegions
  regionEditors: Record<RegionKind, Editor>
  draft: DraftDocument
  pageCount: number
}

export function DraftEditorCanvas({
  editor,
  regions,
  regionEditors,
  draft,
  pageCount,
}: DraftEditorCanvasProps) {
  const dims = useMemo(
    () => getPageDimensions(draft.pageSetup),
    [draft.pageSetup]
  )
  const stride = dims.heightPx + PAGE_GAP
  const stackHeight = pageCount * dims.heightPx + (pageCount - 1) * PAGE_GAP
  const pages = Array.from({ length: pageCount }, (_, index) => index)
  const [hoveredRegion, setHoveredRegion] = useState<PageRegion | null>(null)

  const { editable } = draft
  const activeRegion = editable ? regions.active : null
  const headerHeight = useRegionHeight(
    regionEditors.header,
    activeRegion?.kind === "header"
  )
  const footerHeight = useRegionHeight(
    regionEditors.footer,
    activeRegion?.kind === "footer"
  )
  const layout = useMemo(
    () => getSheetLayout(dims, headerHeight, footerHeight),
    [dims, headerHeight, footerHeight]
  )
  const regionHtml = {
    header: useRegionHtml(regionEditors.header),
    footer: useRegionHtml(regionEditors.footer),
  }

  // A hot reload keeps an editor created before the pagination extension
  // existed; only a full page reload picks it up.
  const paginated = typeof editor.commands.setPageGeometry === "function"
  useEffect(() => {
    if (!paginated)
      console.warn(
        "Drafting editor: pagination extension missing, reload the page"
      )
  }, [paginated])

  // The pagination plugin needs the sheet geometry to know where pages end;
  // a tall header or footer moves the body's edges past the margins.
  useEffect(() => {
    if (!paginated) return
    editor.commands.setPageGeometry({
      pageHeight: layout.pageHeight,
      marginTop: layout.bodyTop,
      marginBottom: layout.bodyBottom,
      gap: PAGE_GAP,
    })
  }, [editor, paginated, layout])

  // A theme swaps the fonts and side margins change the line width; both move the
  // text without any transaction, so ask for a re-measure.
  useEffect(() => {
    if (paginated) editor.commands.repaginate()
  }, [editor, paginated, draft.theme, layout.marginLeft, layout.marginRight])

  // Clicking the grey desk below the pages drops the caret at the end of the draft.
  const focusFromDesk = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !editor.isEditable) return
    event.preventDefault()
    editor.commands.focus("end")
  }

  // Clicking a page margin places the caret at the nearest text.
  const focusFromMargin = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !editor.isEditable) return
    event.preventDefault()
    const root = editor.view.dom.getBoundingClientRect()
    const found = editor.view.posAtCoords({
      left: Math.min(Math.max(event.clientX, root.left + 1), root.right - 1),
      top: Math.min(Math.max(event.clientY, root.top + 1), root.bottom - 1),
    })
    if (found) editor.chain().focus().setTextSelection(found.pos).run()
    else editor.commands.focus("end")
  }

  // Outline the header or footer margin under the pointer, but not while dragging a selection.
  const trackRegion = (event: MouseEvent<HTMLDivElement>) => {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top
    const next =
      event.buttons === 0 ? regionAt(y, layout, stride, pageCount) : null
    setHoveredRegion((prev) => (isSameRegion(prev, next) ? prev : next))
  }

  // The page being edited hosts the live editor; page 1 holds it otherwise.
  const livePage = (kind: RegionKind) =>
    activeRegion?.kind === kind ? Math.min(activeRegion.page, pageCount - 1) : 0

  // A click on another page moves the live editor there first; the caret is
  // placed once it has mounted.
  const pendingFocus = useRef<{ kind: RegionKind; point: ScreenPoint } | null>(
    null
  )
  const activateRegion = (region: PageRegion, point: ScreenPoint | null) => {
    if (isSameRegion(activeRegion, region)) {
      if (point) focusAt(regionEditors[region.kind], point)
      return
    }
    pendingFocus.current = point && { kind: region.kind, point }
    regions.activate(region)
  }
  useLayoutEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    focusAt(regionEditors[pending.kind], pending.point)
  }, [activeRegion, regionEditors])

  const themeVars = useMemo(() => themeCssVars(draft.theme), [draft.theme])

  return (
    <div
      className="relative min-h-0 flex-1 overflow-auto bg-muted/60 dark:bg-muted/20"
      onMouseDown={focusFromDesk}
    >
      {/* Top ruler: sticky while scrolling down, scrolls sideways with the page. */}
      <div className="sticky top-0 z-20 flex w-full min-w-max border-b border-border bg-card/95 backdrop-blur-sm">
        <div
          className="sticky left-0 z-10 shrink-0 border-r border-border bg-card"
          style={{ width: V_RULER_WIDTH }}
        />
        <div
          className="flex flex-1 justify-center"
          style={{ paddingInline: CANVAS_GUTTER }}
        >
          <HorizontalRuler
            dims={dims}
            onSideMarginChange={
              editable
                ? (sideMargin) => draft.updatePageSetup({ sideMargin })
                : undefined
            }
          />
        </div>
      </div>

      <div className="flex w-full min-w-max">
        {/* Side rulers, one per sheet: sticky while scrolling sideways, scroll with the pages vertically. */}
        <div
          className="sticky left-0 z-10 shrink-0 self-start border-r border-border bg-card"
          style={{ width: V_RULER_WIDTH, paddingBlock: PAGE_GAP }}
        >
          {pages.map((index) => (
            <div key={index} style={{ marginTop: index === 0 ? 0 : PAGE_GAP }}>
              <VerticalRuler dims={dims} />
            </div>
          ))}
        </div>

        <div
          className="flex flex-1 justify-center"
          style={{
            paddingInline: CANVAS_GUTTER,
            paddingTop: PAGE_GAP,
            paddingBottom: PAGE_GAP,
          }}
          onMouseDown={focusFromDesk}
        >
          <div
            className="relative shrink-0"
            style={{ width: dims.widthPx, height: stackHeight }}
            onMouseMove={trackRegion}
            onMouseLeave={() => setHoveredRegion(null)}
          >
            {/* One sheet per page, drawn behind the text. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              {pages.map((index) => (
                <div
                  key={index}
                  className="draft-sheet absolute inset-x-0 rounded-md shadow-md ring-1 ring-black/5"
                  style={{ top: index * stride, height: dims.heightPx }}
                />
              ))}
            </div>
            {/* The text flows continuously; the pagination plugin pads it across the gaps. */}
            <div
              data-show-marks={draft.showMarks}
              data-editable={editable}
              className={cn(
                "draft-page relative",
                !editable && "cursor-default"
              )}
              style={{
                ...themeVars,
                height: stackHeight,
                paddingTop: layout.bodyTop,
                paddingBottom: layout.bodyBottom,
                paddingLeft: layout.marginLeft,
                paddingRight: layout.marginRight,
              }}
              onMouseDown={focusFromMargin}
            >
              <EditorContent editor={editor} className="h-full" />
            </div>
            {/* Header and footer of every page, above the body so the margins take the clicks. */}
            <div className="pointer-events-none absolute inset-0">
              {pages.map((page) =>
                REGION_KINDS.map((kind) => {
                  const region = { page, kind }
                  return (
                    <PageRegionSlot
                      key={`${kind}-${page}`}
                      region={region}
                      editor={regionEditors[kind]}
                      html={regionHtml[kind]}
                      layout={layout}
                      stride={stride}
                      live={page === livePage(kind)}
                      active={isSameRegion(activeRegion, region)}
                      outlined={
                        editable &&
                        (isSameRegion(hoveredRegion, region) ||
                          isSameRegion(activeRegion, region))
                      }
                      disabled={!editable}
                      showMarks={draft.showMarks}
                      themeVars={themeVars}
                      onActivate={activateRegion}
                      onExit={regions.exit}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
