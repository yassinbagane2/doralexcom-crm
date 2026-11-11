import {
  FileImage,
  FileText,
  PdfDocument,
  WordDocument,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

/** What a document looks like at a glance, from its MIME type. */
export type FileKind = "pdf" | "word" | "image" | "text"

export function fileKind(mimeType: string | null): FileKind {
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType?.startsWith("image/")) return "image"
  if (
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.oasis.opendocument.text"
  ) {
    return "word"
  }
  return "text"
}

/**
 * The document's type as a small coloured tile: red for PDFs, blue for Word
 * documents (contracts too: they export as .docx), as in the file manager.
 */
export function FileTypeIcon({
  kind,
  className,
}: {
  kind: FileKind
  className?: string
}) {
  const tile = "grid size-9 shrink-0 place-items-center rounded-lg"

  switch (kind) {
    case "pdf":
      return (
        <span className={cn(tile, "bg-[#D17866] text-white", className)}>
          <PdfDocument size={20} />
        </span>
      )
    case "word":
      return (
        <span className={cn(tile, "bg-[#5b82b5] text-white", className)}>
          <WordDocument size={18} />
        </span>
      )
    case "image":
      return (
        <span
          className={cn(
            tile,
            "bg-sky-500/10 text-sky-600 dark:text-sky-400",
            className
          )}
        >
          <FileImage className="size-4.5" />
        </span>
      )
    default:
      return (
        <span className={cn(tile, "bg-muted text-muted-foreground", className)}>
          <FileText className="size-4.5" />
        </span>
      )
  }
}
