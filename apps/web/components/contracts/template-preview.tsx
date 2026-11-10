"use client"

import { generateHTML, type JSONContent } from "@tiptap/core"
import {
  isMergeFieldKey,
  MERGE_FIELD_NODE,
  type ContentNode,
  type DocumentContent,
} from "@workspace/api/contract"
import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import { themeById, themeCssVars } from "@/components/editor/document-options"
import { createDraftExtensions } from "@/components/editor/extensions"
import {
  DEFAULT_PAGE_SETUP,
  getPageDimensions,
  toPageSetup,
} from "@/components/editor/page-geometry"
import "@/components/editor/draft-editor.css"

/**
 * A template's first page, drawn with the editor's own page styles, scaled
 * to the card's width and cropped by the frame. Blank until `content` loads,
 * or if it can't be read.
 */
export function TemplatePreview({
  content,
}: {
  content: DocumentContent | undefined
}) {
  const tf = useTranslations("MergeFields")
  const frameRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(frameRef)

  const fieldLabel = useCallback(
    (key: string) => (isMergeFieldKey(key) ? tf(`fields.${key}`) : key),
    [tf]
  )
  const html = useMemo(() => {
    if (!content) return ""
    try {
      // A preview is a single page: no pagination.
      const extensions = createDraftExtensions("", {
        paginate: false,
        fieldLabel,
      })
      return generateHTML(content.body as JSONContent, extensions)
    } catch {
      // Content this editor can't read leaves the page blank.
      return ""
    }
  }, [content, fieldLabel])

  const dims = getPageDimensions(
    content ? toPageSetup(content.pageSetup) : DEFAULT_PAGE_SETUP
  )
  const scale = width / dims.widthPx

  return (
    <div
      ref={frameRef}
      aria-hidden="true"
      className="aspect-video overflow-hidden rounded-lg border bg-muted px-2.5 pt-2.5"
    >
      {width > 0 && (
        <div
          className="draft-sheet overflow-hidden rounded-t-md shadow-xs"
          style={{ height: dims.heightPx * scale }}
        >
          <div
            className="draft-page pointer-events-none origin-top-left select-none"
            style={{
              ...themeCssVars(themeById(content?.themeId)),
              width: dims.widthPx,
              paddingTop: dims.marginPx.top,
              paddingRight: dims.marginPx.right,
              paddingBottom: dims.marginPx.bottom,
              paddingLeft: dims.marginPx.left,
              transform: `scale(${scale})`,
            }}
          >
            <div
              className="ProseMirror"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** How many different fields a template fills in, header and footer included. */
export function countMergeFields(content: DocumentContent) {
  const keys = new Set<string>()
  const visit = (node: ContentNode | null) => {
    if (!node) return
    if (node.type === MERGE_FIELD_NODE && isMergeFieldKey(node.attrs?.key)) {
      keys.add(node.attrs.key)
    }
    node.content?.forEach(visit)
  }
  visit(content.body)
  visit(content.header)
  visit(content.footer)
  return keys.size
}

/** Calls `onVisible` when `ref`'s element scrolls into view, while `enabled`. */
export function useOnVisible(
  ref: RefObject<Element | null>,
  onVisible: () => void,
  enabled: boolean
) {
  const onVisibleRef = useRef(onVisible)
  useEffect(() => {
    onVisibleRef.current = onVisible
  })

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])
}

/** Width of `ref`'s content box in CSS pixels, kept current (0 until measured). */
function useElementWidth(ref: RefObject<Element | null>) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
