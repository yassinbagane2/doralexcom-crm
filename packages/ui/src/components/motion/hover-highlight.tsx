"use client"

import { motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react"

import { cn } from "@workspace/ui/lib/utils"

export type HighlightRect = {
  x: number
  y: number
  width: number
  height: number
  opacity: number
  visible: boolean
  /** True when the highlight appears from hidden: jump to the target instead of sliding. */
  snap: boolean
}

/**
 * Tracks the hovered item inside a container so a single <HoverHighlight />
 * can slide between items instead of each item painting its own hover background.
 */
export function useHoverHighlight() {
  const containerRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<{ el: HTMLElement; opacity: number } | null>(null)
  const [rect, setRect] = useState<HighlightRect | null>(null)

  // Keep the last position so the highlight fades out where it was.
  const hide = useCallback(() => {
    targetRef.current = null
    setRect((prev) => prev && { ...prev, visible: false })
  }, [])

  const measure = useCallback(() => {
    const container = containerRef.current
    const target = targetRef.current
    if (!container || !target || !target.el.isConnected) {
      hide()
      return
    }

    const containerBox = container.getBoundingClientRect()
    const targetBox = target.el.getBoundingClientRect()
    setRect((prev) => ({
      x: targetBox.left - containerBox.left,
      y: targetBox.top - containerBox.top,
      width: targetBox.width,
      height: targetBox.height,
      opacity: target.opacity,
      visible: true,
      snap: !prev?.visible,
    }))
  }, [hide])

  // Items can shift while hovered (e.g. a route's sub-links collapse after navigating).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (targetRef.current) measure()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [measure])

  const containerProps = {
    ref: containerRef,
    onMouseLeave: hide,
  }

  const getTargetProps = (opacity = 1) => ({
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      targetRef.current = { el: event.currentTarget, opacity }
      measure()
    },
  })

  return { containerProps, getTargetProps, rect }
}

export function HoverHighlight({
  rect,
  className,
}: {
  rect: HighlightRect | null
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const move =
    reduceMotion || rect?.snap
      ? { duration: 0 }
      : { type: "spring" as const, stiffness: 500, damping: 40 }

  return (
    <motion.div
      aria-hidden
      initial={false}
      className={cn(
        "pointer-events-none absolute top-0 left-0 -z-10",
        className
      )}
      animate={
        rect
          ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              opacity: rect.visible ? rect.opacity : 0,
            }
          : { opacity: 0 }
      }
      transition={{ default: move, opacity: { duration: 0.15 } }}
    />
  )
}
