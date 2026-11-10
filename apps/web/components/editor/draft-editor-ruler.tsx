"use client"

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import {
  CM,
  clampSideMargin,
  formatCm,
  maxSideMargin,
  type PageDimensions,
} from "./page-geometry"

const H_RULER_HEIGHT = 24
export const V_RULER_WIDTH = 36

type Tick = { offset: number; kind: "cm" | "half" | "quarter"; cm: number }

function buildTicks(lengthCm: number): Tick[] {
  const ticks: Tick[] = []
  const total = Math.floor(lengthCm * 4)
  for (let i = 0; i <= total; i++) {
    const kind: Tick["kind"] =
      i % 4 === 0 ? "cm" : i % 2 === 0 ? "half" : "quarter"
    ticks.push({ offset: (i / 4) * CM, kind, cm: i / 4 })
  }
  return ticks
}

type Side = "left" | "right"

/** Arrow keys move a margin marker by a millimetre, or a centimetre with Shift. */
const KEY_STEP_CM = 0.1
const KEY_STEP_LARGE_CM = 1

/** Wide enough to grab easily; the drawn marker is 10px. */
const HANDLE_WIDTH = 14

type MarkerHandlers = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

type Drag = {
  /** The marker being held; the other one mirrors it. */
  side: Side
  cm: number
  /** Pointer distance from the marker's centre when grabbed, so the marker doesn't jump to it. */
  grabOffset: number
}

type HorizontalRulerProps = {
  dims: PageDimensions
  /**
   * Makes the margin markers draggable. Both sides share one margin, so moving either
   * marker moves the other. Called when a drag ends, or when a key moves a marker.
   */
  onSideMarginChange?: (cm: number) => void
}

/**
 * Centimetre ruler drawn above the page, with the side margins shaded and marked. With
 * `onSideMarginChange`, dragging a marker resizes both side margins: the ruler, guide
 * lines and the value follow the pointer, and the page reflows once it's released.
 */
export function HorizontalRuler({
  dims,
  onSideMarginChange,
}: HorizontalRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  const width = dims.widthPx
  const height = H_RULER_HEIGHT
  const baseline = height - 1
  const sideCm = drag?.cm ?? dims.marginCm.left
  const markerX: Record<Side, number> = {
    left: sideCm * CM,
    right: width - sideCm * CM,
  }
  const ticks = buildTicks(dims.widthCm)

  const settle = (cm: number) =>
    Math.round(clampSideMargin(cm, dims.widthCm) * 100) / 100

  const marginAt = (side: Side, clientX: number, grabOffset: number) => {
    const x =
      clientX -
      grabOffset -
      (rulerRef.current?.getBoundingClientRect().left ?? 0)
    return (side === "left" ? x : width - x) / CM
  }

  const commit = (cm: number) => {
    if (cm !== dims.marginCm.left) onSideMarginChange?.(cm)
  }

  const handlersFor = (side: Side): MarkerHandlers => ({
    onPointerDown: (event) => {
      if (event.button !== 0) return
      // Keeps the caret in the document; keyboard users reach the markers with Tab.
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const rulerLeft = rulerRef.current?.getBoundingClientRect().left ?? 0
      setDrag({
        side,
        cm: sideCm,
        grabOffset: event.clientX - rulerLeft - markerX[side],
      })
    },
    onPointerMove: (event) => {
      if (drag?.side !== side) return
      setDrag({
        ...drag,
        cm: settle(marginAt(side, event.clientX, drag.grabOffset)),
      })
    },
    onPointerUp: () => {
      if (drag?.side !== side) return
      commit(drag.cm)
      setDrag(null)
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      const step = event.shiftKey ? KEY_STEP_LARGE_CM : KEY_STEP_CM
      // A marker moving towards the middle of the page widens the margins.
      const towardsCentre = (event.key === "ArrowRight") === (side === "left")
      commit(settle(sideCm + (towardsCentre ? step : -step)))
    },
  })

  return (
    <div
      ref={rulerRef}
      className="relative select-none"
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        className="block"
        style={{ shapeRendering: "crispEdges" }}
      >
        <rect
          x={0}
          y={0}
          width={markerX.left}
          height={height}
          className="fill-muted"
        />
        <rect
          x={markerX.right}
          y={0}
          width={width - markerX.right}
          height={height}
          className="fill-muted"
        />
        <line
          x1={0}
          y1={baseline}
          x2={width}
          y2={baseline}
          className="stroke-border"
          strokeWidth={1}
        />
        {ticks.map((tick) => {
          if (tick.kind === "cm") {
            if (tick.cm === 0 || tick.cm >= dims.widthCm) return null
            return (
              <text
                key={tick.offset}
                x={tick.offset}
                y={baseline - 6}
                textAnchor="middle"
                fontSize={10}
                className="fill-muted-foreground font-sans"
                style={{ shapeRendering: "auto" }}
              >
                {tick.cm}
              </text>
            )
          }
          const size = tick.kind === "half" ? 6 : 3
          return (
            <line
              key={tick.offset}
              x1={tick.offset}
              y1={baseline - size}
              x2={tick.offset}
              y2={baseline}
              className="stroke-muted-foreground/70"
              strokeWidth={1}
            />
          )
        })}
      </svg>

      {(["left", "right"] as const).map((side) => (
        <MarginMarker
          key={side}
          side={side}
          x={markerX[side]}
          valueCm={sideCm}
          maxCm={maxSideMargin(dims.widthCm)}
          dragging={drag !== null}
          held={drag?.side === side}
          handlers={onSideMarginChange ? handlersFor(side) : undefined}
        />
      ))}
    </div>
  )
}

type MarginMarkerProps = {
  side: Side
  x: number
  valueCm: number
  maxCm: number
  /** Either marker is being dragged: both draw a guide line down the page. */
  dragging: boolean
  /** This marker is the one held: it shows the value. */
  held: boolean
  /** Present when the margins can be changed; the marker is only drawn otherwise. */
  handlers?: MarkerHandlers
}

/**
 * A margin marker: Word's hourglass on the left (first-line and hanging indent, which
 * follow the margin here), a single triangle on the right. Shows the side margin in cm
 * while held or focused from the keyboard.
 */
function MarginMarker({
  side,
  x,
  valueCm,
  maxCm,
  dragging,
  held,
  handlers,
}: MarginMarkerProps) {
  const t = useTranslations("Editor.ruler")
  const interactive = handlers !== undefined
  const centre = HANDLE_WIDTH / 2
  const baseline = H_RULER_HEIGHT - 1
  const value = `${formatCm(valueCm)} cm`

  return (
    <div
      data-held={held}
      {...(interactive
        ? {
            role: "slider",
            tabIndex: 0,
            "aria-label": t(side === "left" ? "leftMargin" : "rightMargin"),
            "aria-orientation": "horizontal" as const,
            "aria-valuemin": 0,
            "aria-valuemax": maxCm,
            "aria-valuenow": valueCm,
            "aria-valuetext": t("valueText", { value }),
            ...handlers,
          }
        : { "aria-hidden": true })}
      className={cn(
        "group absolute top-0 h-full -translate-x-1/2 outline-none",
        interactive ? "cursor-ew-resize touch-none" : "pointer-events-none"
      )}
      style={{ left: x, width: HANDLE_WIDTH }}
    >
      <svg
        width={HANDLE_WIDTH}
        height={H_RULER_HEIGHT}
        aria-hidden="true"
        className="fill-blue-600 group-focus-visible:fill-blue-500 dark:fill-blue-400"
      >
        <path d={`M${centre - 5} ${baseline - 12} h10 l-5 6 z`} />
        {side === "left" && (
          <path d={`M${centre - 5} ${baseline} h10 l-5 -6 z`} />
        )}
      </svg>
      {interactive && (
        <>
          <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background tabular-nums shadow-md group-focus-visible:block group-data-[held=true]:block">
            {t("sideMargins", { value })}
          </span>
          {dragging && (
            <span className="pointer-events-none absolute top-full left-1/2 h-[200vh] border-l border-dashed border-blue-500/70" />
          )}
        </>
      )}
    </div>
  )
}

/** Centimetre ruler drawn to the left of the page. */
export function VerticalRuler({ dims }: { dims: PageDimensions }) {
  const width = V_RULER_WIDTH
  const height = dims.heightPx
  const edge = width - 1
  const { top, bottom } = dims.marginPx
  const bottomMargin = height - bottom
  const ticks = buildTicks(dims.heightCm)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="block select-none"
      style={{ shapeRendering: "crispEdges" }}
    >
      <rect x={0} y={0} width={width} height={top} className="fill-muted" />
      <rect
        x={0}
        y={bottomMargin}
        width={width}
        height={bottom}
        className="fill-muted"
      />
      <line
        x1={edge}
        y1={0}
        x2={edge}
        y2={height}
        className="stroke-border"
        strokeWidth={1}
      />
      <line
        x1={0}
        y1={top}
        x2={width}
        y2={top}
        className="stroke-foreground/70"
        strokeWidth={1.5}
      />
      <line
        x1={0}
        y1={bottomMargin}
        x2={width}
        y2={bottomMargin}
        className="stroke-foreground/70"
        strokeWidth={1.5}
      />
      {ticks.map((tick) => {
        if (tick.kind === "cm") {
          if (tick.cm === 0 || tick.cm >= dims.heightCm) return null
          return (
            <g key={tick.offset}>
              <text
                x={edge - 12}
                y={tick.offset + 3.5}
                textAnchor="end"
                fontSize={10}
                className="fill-muted-foreground font-sans"
                style={{ shapeRendering: "auto" }}
              >
                {tick.cm}
              </text>
              <line
                x1={edge - 9}
                y1={tick.offset}
                x2={edge}
                y2={tick.offset}
                className="stroke-muted-foreground/70"
                strokeWidth={1}
              />
            </g>
          )
        }
        const size = tick.kind === "half" ? 6 : 3
        return (
          <line
            key={tick.offset}
            x1={edge - size}
            y1={tick.offset}
            x2={edge}
            y2={tick.offset}
            className="stroke-muted-foreground/70"
            strokeWidth={1}
          />
        )
      })}
    </svg>
  )
}
