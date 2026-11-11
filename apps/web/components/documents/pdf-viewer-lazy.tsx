"use client"

import { LoaderCircle } from "@workspace/ui/icons"
import dynamic from "next/dynamic"

/** The PDF viewer, loaded in the browser only (pdf.js needs a DOM). */
export const PdfViewer = dynamic(
  () => import("./pdf-viewer").then((mod) => mod.PdfViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)
