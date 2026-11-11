/** The longest side a property photo keeps: sharp full-screen, still light. */
const MAX_SIDE = 2400
const QUALITY = 0.85

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, QUALITY)
  )
}

/**
 * Re-encodes a picture the way photos are kept: upright, at most MAX_SIDE
 * pixels on its longest side, as WebP (JPEG where the browser can't write
 * WebP). Drawing it afresh also drops its metadata, such as where a phone
 * took it. Throws when the browser can't read the picture at all (HEIC
 * outside Safari, a broken file…).
 */
export async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  })
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // Browsers that can't write WebP hand back a PNG instead: far too heavy
    // for a photo, so fall back to JPEG.
    let blob = await toBlob(canvas, "image/webp")
    if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg")
    if (!blob) throw new Error("Could not encode the image")

    const extension = blob.type === "image/webp" ? "webp" : "jpg"
    const base = file.name.replace(/\.[^.]+$/, "") || "photo"
    return new File([blob], `${base}.${extension}`, { type: blob.type })
  } finally {
    bitmap.close()
  }
}
