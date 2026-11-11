"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { Input } from "@workspace/ui/components/ui/input"
import { Eraser, ImageUp, Pen, Type } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { Dancing_Script } from "next/font/google"
import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react"

/** The handwriting a typed signature is drawn in. */
const handwriting = Dancing_Script({ subsets: ["latin", "latin-ext"] })

const MODES = ["draw", "type", "upload"] as const
type Mode = (typeof MODES)[number]

/** The pad's drawing surface, in CSS pixels; drawn at twice that. */
const WIDTH = 560
const HEIGHT = 180
const SCALE = 2
const INK = "#1e293b"

/** Uploads larger than this are refused before they're read. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * The canvas cut down to what's drawn on it, with a little margin, as a
 * transparent PNG. Null when nothing is drawn.
 */
function trimmedPng(canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext("2d")
  if (!context) return null
  const { width, height } = canvas
  const pixels = context.getImageData(0, 0, width, height).data

  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3]! > 16) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return null

  const margin = 8 * SCALE
  const sx = Math.max(0, left - margin)
  const sy = Math.max(0, top - margin)
  const sw = Math.min(width, right + margin) - sx
  const sh = Math.min(height, bottom + margin) - sy

  const out = document.createElement("canvas")
  out.width = sw
  out.height = sh
  out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return out.toDataURL("image/png")
}

function clear(canvas: HTMLCanvasElement) {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
}

/**
 * Captures a signature, the way DocuSeal does: drawn with a finger or mouse,
 * typed in handwriting, or uploaded as a picture. Reports it as a trimmed,
 * transparent PNG data URL, or null while there is none.
 */
export function SignaturePad({
  defaultName = "",
  onChange,
  className,
}: {
  /** What a typed signature starts out saying. */
  defaultName?: string
  onChange: (image: string | null) => void
  className?: string
}) {
  const t = useTranslations("SignaturePad")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>("draw")
  const [typed, setTyped] = useState(defaultName)
  const [empty, setEmpty] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)

  const report = useCallback(() => {
    const canvas = canvasRef.current
    const image = canvas ? trimmedPng(canvas) : null
    setEmpty(image === null)
    onChange(image)
  }, [onChange])

  const reset = useCallback(() => {
    if (canvasRef.current) clear(canvasRef.current)
    setEmpty(true)
    onChange(null)
  }, [onChange])

  // Switching how to sign starts over.
  useEffect(() => {
    reset()
    setUploadError(null)
  }, [mode, reset])

  // A typed signature is drawn as it's typed, once the font is in.
  useEffect(() => {
    if (mode !== "type") return
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    let cancelled = false

    const family = handwriting.style.fontFamily
    void document.fonts.load(`${64 * SCALE}px ${family}`).then(() => {
      if (cancelled) return
      clear(canvas)
      const text = typed.trim()
      if (text) {
        let size = 64 * SCALE
        context.font = `${size}px ${family}`
        // Shrinks a long name until it fits the pad.
        while (
          size > 20 &&
          context.measureText(text).width > canvas.width - 40 * SCALE
        ) {
          size -= 4
          context.font = `${size}px ${family}`
        }
        context.fillStyle = INK
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.fillText(text, canvas.width / 2, canvas.height / 2)
      }
      report()
    })

    return () => {
      cancelled = true
    }
  }, [mode, typed, report])

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH * SCALE,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT * SCALE,
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "draw") return
    event.currentTarget.setPointerCapture(event.pointerId)
    const start = point(event)
    drawing.current = start
    const context = event.currentTarget.getContext("2d")
    if (!context) return
    // A tap leaves a dot.
    context.fillStyle = INK
    context.beginPath()
    context.arc(start.x, start.y, 1.4 * SCALE, 0, Math.PI * 2)
    context.fill()
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const last = drawing.current
    const context = event.currentTarget.getContext("2d")
    if (!last || !context) return
    const next = point(event)
    // Pressure, where the pen reports it, thickens the line a little.
    const pressure = event.pressure > 0 ? event.pressure : 0.5
    context.strokeStyle = INK
    context.lineWidth = (1.8 + pressure * 1.6) * SCALE
    context.lineCap = "round"
    context.lineJoin = "round"
    context.beginPath()
    context.moveTo(last.x, last.y)
    const mid = { x: (last.x + next.x) / 2, y: (last.y + next.y) / 2 }
    context.quadraticCurveTo(last.x, last.y, mid.x, mid.y)
    context.lineTo(next.x, next.y)
    context.stroke()
    drawing.current = next
  }

  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = null
    report()
  }

  const onUpload = async (file: File | undefined) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!file || !canvas || !context) return
    setUploadError(null)
    if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES) {
      setUploadError(t("uploadInvalid"))
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      clear(canvas)
      const fit = Math.min(
        (canvas.width - 16 * SCALE) / bitmap.width,
        (canvas.height - 16 * SCALE) / bitmap.height,
        SCALE * 2
      )
      const w = bitmap.width * fit
      const h = bitmap.height * fit
      context.drawImage(
        bitmap,
        (canvas.width - w) / 2,
        (canvas.height - h) / 2,
        w,
        h
      )
      bitmap.close()
      // A signature photographed on paper: the paper goes, the ink stays.
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = image.data
      for (let i = 0; i < data.length; i += 4) {
        const lightness = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
        if (lightness > 225) data[i + 3] = 0
      }
      context.putImageData(image, 0, 0)
      report()
    } catch {
      setUploadError(t("uploadInvalid"))
    }
  }

  const modeIcon = { draw: Pen, type: Type, upload: ImageUp } as const

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="tablist"
        aria-label={t("modeLabel")}
        className="inline-flex self-start rounded-lg bg-muted p-0.5"
      >
        {MODES.map((value) => {
          const Icon = modeIcon[value]
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                mode === value && "bg-background text-foreground shadow-xs"
              )}
            >
              <Icon className="size-3.5" />
              {t(`modes.${value}`)}
            </button>
          )
        })}
      </div>

      {mode === "type" ? (
        <Input
          value={typed}
          maxLength={60}
          autoComplete="name"
          aria-label={t("typeLabel")}
          placeholder={t("typePlaceholder")}
          onChange={(event) => setTyped(event.target.value)}
        />
      ) : null}

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={WIDTH * SCALE}
          height={HEIGHT * SCALE}
          aria-label={t("canvasLabel")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "aspect-[56/18] w-full touch-none rounded-lg border border-dashed bg-white",
            mode === "draw" ? "cursor-crosshair" : "cursor-default"
          )}
        />
        {/* The line to sign on. */}
        <span className="pointer-events-none absolute inset-x-8 bottom-[22%] border-b border-slate-300" />
        {empty && mode !== "type" ? (
          <button
            type="button"
            tabIndex={mode === "upload" ? 0 : -1}
            onClick={() => mode === "upload" && fileRef.current?.click()}
            className={cn(
              "absolute inset-0 flex items-center justify-center text-sm text-slate-400",
              mode === "draw" && "pointer-events-none"
            )}
          >
            {mode === "draw" ? t("drawHint") : t("uploadHint")}
          </button>
        ) : null}
        {!empty ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-900"
            onClick={() => {
              reset()
              if (mode === "type") setTyped("")
            }}
          >
            <Eraser className="size-3.5" />
            {t("clear")}
          </Button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          void onUpload(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      {uploadError ? (
        <p className="text-xs text-destructive">{uploadError}</p>
      ) : null}
    </div>
  )
}
