"use client"

import { useEffect, useRef, type RefObject } from "react"

/**
 * Runs `onVisible` whenever `ref`'s element scrolls into view while `enabled`.
 * Turning `enabled` back on re-checks straight away, so a caller that pauses
 * it while busy (an infinite list loading a page) is called again if the
 * element is still on screen.
 */
export function useOnVisible(
  ref: RefObject<Element | null>,
  onVisible: () => void,
  enabled: boolean
) {
  const onVisibleRef = useRef(onVisible)
  useEffect(() => {
    onVisibleRef.current = onVisible
  })

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])
}
