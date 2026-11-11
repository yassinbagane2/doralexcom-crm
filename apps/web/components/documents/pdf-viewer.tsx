"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  AlertCircle,
  Check,
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// As in Deo: the worker matching the bundled pdf.js, from its CDN.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.25
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2]
/** Room left around a page fitted to the viewer's width. */
const GUTTER = 32

/**
 * A PDF drawn page by page with react-pdf (the viewer Deo uses): page
 * navigation, zoom and fit-to-width, selectable text. Load it through
 * `PdfViewer` in pdf-viewer-lazy.tsx: pdf.js only runs in the browser.
 */
export function PdfViewerClient({
  file,
  toolbarEnd,
  className,
}: {
  /** The PDF's bytes, or its URL. */
  file: Blob | string
  /** Extra controls at the toolbar's end, such as a download button. */
  toolbarEnd?: ReactNode
  className?: string
}) {
  const t = useTranslations("PdfViewer")
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [fitToWidth, setFitToWidth] = useState(true)
  const [editingPage, setEditingPage] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The page most in view is the current one.
  useEffect(() => {
    const element = containerRef.current
    if (!element || !numPages) return
    const ratios = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number(entry.target.getAttribute("data-page"))
          if (page) ratios.set(page, entry.intersectionRatio)
        }
        let best = 1
        let bestRatio = 0
        ratios.forEach((ratio, page) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = page
          }
        })
        if (bestRatio > 0) setCurrentPage(best)
      },
      { root: element, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    pageRefs.current.forEach((div) => observer.observe(div))
    return () => observer.disconnect()
  }, [numPages, scale, fitToWidth])

  const goToPage = useCallback((page: number) => {
    pageRefs.current
      .get(page)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const commitPageInput = () => {
    const page = Number.parseInt(editingPage ?? "", 10)
    if (numPages && page >= 1 && page <= numPages) goToPage(page)
    setEditingPage(null)
  }

  const zoomTo = (value: number) => {
    setFitToWidth(false)
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)))
  }

  const setPageRef = useCallback(
    (page: number) => (element: HTMLDivElement | null) => {
      if (element) pageRefs.current.set(page, element)
      else pageRefs.current.delete(page)
    },
    []
  )

  const width =
    fitToWidth && containerWidth > 0
      ? Math.min(containerWidth - GUTTER, 1000)
      : undefined

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b bg-background px-2 py-1.5">
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 px-1 py-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("previousPage")}
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <input
            type="text"
            inputMode="numeric"
            aria-label={t("page")}
            value={editingPage ?? String(currentPage)}
            onFocus={(event) => setEditingPage(event.target.value)}
            onChange={(event) => setEditingPage(event.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(event) => event.key === "Enter" && commitPageInput()}
            className="w-9 rounded-md border bg-background px-1 py-0.5 text-center text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            / {numPages ?? "…"}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("nextPage")}
            disabled={!numPages || currentPage >= numPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 px-1 py-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomOut")}
            disabled={!fitToWidth && scale <= MIN_SCALE}
            onClick={() => zoomTo(scale - SCALE_STEP)}
          >
            <ZoomOut className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="min-w-12 rounded-md px-1.5 py-0.5 text-center text-xs tabular-nums hover:bg-background"
                />
              }
            >
              {fitToWidth ? t("fit") : `${Math.round(scale * 100)}%`}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-32">
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset}
                  onClick={() => zoomTo(preset)}
                  className="justify-between"
                >
                  {Math.round(preset * 100)}%
                  {!fitToWidth && scale === preset ? (
                    <Check className="size-3 text-muted-foreground" />
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setFitToWidth(true)}
                className="justify-between"
              >
                {t("fitToWidth")}
                {fitToWidth ? (
                  <Check className="size-3 text-muted-foreground" />
                ) : null}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomIn")}
            disabled={!fitToWidth && scale >= MAX_SCALE}
            onClick={() => zoomTo(scale + SCALE_STEP)}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("fitToWidth")}
            aria-pressed={fitToWidth}
            className={cn(fitToWidth && "bg-background")}
            onClick={() => setFitToWidth((fit) => !fit)}
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>

        {toolbarEnd}
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-auto bg-muted/50 p-4"
      >
        <Document
          file={file}
          onLoadSuccess={({ numPages: pages }) => {
            setNumPages(pages)
            setCurrentPage(1)
          }}
          loading={<PageSkeleton />}
          error={
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <AlertCircle className="size-5" />
              {t("failed")}
            </div>
          }
        >
          {numPages
            ? Array.from({ length: numPages }, (_, index) => (
                <div
                  key={index + 1}
                  data-page={index + 1}
                  ref={setPageRef(index + 1)}
                  className="mb-6 flex justify-center"
                >
                  <div className="overflow-hidden rounded-sm shadow-md ring-1 ring-black/10">
                    <Page
                      pageNumber={index + 1}
                      scale={fitToWidth ? undefined : scale}
                      width={width}
                      renderTextLayer
                      renderAnnotationLayer
                      loading={<PageSkeleton />}
                    />
                  </div>
                </div>
              ))
            : null}
        </Document>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto flex aspect-[1/1.414] w-full max-w-3xl flex-col gap-3 rounded-sm bg-background p-10 shadow-md">
      {[75, 100, 85, 100, 65, 100, 80].map((width, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded bg-muted"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  )
}
