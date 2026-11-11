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
  const frameRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(frameRef)
  const html = useContentHtml(content?.body)

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

/**
 * A document part (body, header or footer) as HTML, drawn by the editor's own
 * extensions without pagination. Empty until `node` loads, or if it can't be
 * read.
 */
export function useContentHtml(node: ContentNode | null | undefined) {
  const tf = useTranslations("MergeFields")
  const fieldLabel = useCallback(
    (key: string) => (isMergeFieldKey(key) ? tf(`fields.${key}`) : key),
    [tf]
  )
  return useMemo(() => {
    if (!node) return ""
    try {
      const extensions = createDraftExtensions("", {
        paginate: false,
        fieldLabel,
      })
      return generateHTML(node as JSONContent, extensions)
    } catch {
      // Content this editor can't read stays blank.
      return ""
    }
  }, [node, fieldLabel])
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

/** Width of `ref`'s content box in CSS pixels, kept current (0 until measured). */
export function useElementWidth(ref: RefObject<Element | null>) {
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
