/** A file name the operating system accepts, keeping the title as typed otherwise. */
export function safeFileName(
  title: string,
  extension: string,
  fallback: string
) {
  // oxlint-disable-next-line no-control-regex
  const safe = title.replace(/[/\\:*?"<>|\u0000-\u001f]/g, "-").trim()
  const name = safe || fallback
  return name.toLowerCase().endsWith(`.${extension}`)
    ? name
    : `${name}.${extension}`
}

/** Hands the browser a file to save under `name`. */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.style.display = "none"
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers start the download only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Shows a file in a new tab, for types the browser displays itself (PDFs and
 * photos). Only call it with such types: anything else from our own origin
 * could run as a page.
 */
export function openFile(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
