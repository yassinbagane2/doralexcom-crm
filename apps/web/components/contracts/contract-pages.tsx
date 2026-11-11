"use client"

import type { DocumentContent } from "@workspace/api/contract"
import { useRef } from "react"

import {
  useContentHtml,
  useElementWidth,
} from "@/components/contracts/template-preview"
import { themeById, themeCssVars } from "@/components/editor/document-options"
import {
  getPageDimensions,
  toPageSetup,
} from "@/components/editor/page-geometry"
import "@/components/editor/draft-editor.css"

/** Room around the sheet inside the viewer. */
const GUTTER = 32

/**
 * A contract to read, not edit: one continuous sheet at the paper's width
 * (shrunk to fit narrow screens), drawn with the editor's own page styles,
 * header on top and footer at the end.
 */
export function ContractPages({ content }: { content: DocumentContent }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(frameRef)
  const body = useContentHtml(content.body)
  const header = useContentHtml(content.header)
  const footer = useContentHtml(content.footer)

  const dims = getPageDimensions(toPageSetup(content.pageSetup))
  const scale = width > 0 ? Math.min(1, (width - GUTTER) / dims.widthPx) : 1
  const part = (html: string) =>
    html ? (
      <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: html }} />
    ) : null

  return (
    <div ref={frameRef} className="flex justify-center px-4 py-6">
      {width > 0 ? (
        <div
          className="draft-sheet rounded-sm shadow-md ring-1 ring-black/5"
          // `zoom` scales layout too, so the sheet keeps its natural height.
          style={{ zoom: scale }}
        >
          <div
            className="draft-page flex flex-col gap-6"
            style={{
              ...themeCssVars(themeById(content.themeId)),
              width: dims.widthPx,
              minHeight: dims.heightPx,
              paddingTop: dims.marginPx.top,
              paddingRight: dims.marginPx.right,
              paddingBottom: dims.marginPx.bottom,
              paddingLeft: dims.marginPx.left,
            }}
          >
            {part(header)}
            <div className="flex-1">{part(body)}</div>
            {part(footer)}
          </div>
        </div>
      ) : null}
    </div>
  )
}
