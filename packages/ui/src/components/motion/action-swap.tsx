"use client"

import type { ReactNode } from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"

import { EASE_OUT, SPRING_SWAP } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Icon half of beui's action-swap (beui.dev/components/motion/action-swap),
 * as used by the reservi theme toggle. Trimmed to the icon swap: the text and
 * button exports aren't needed here.
 */

export type ActionSwapAnimation = "blur" | "roll"

const BLUR_TRANSITION = { duration: 0.2, ease: "easeInOut" } as const
// Outgoing icon leaves faster than the incoming one arrives, so the two never
// read as a crossfade of equals.
const ROLL_EXIT_TRANSITION = { duration: 0.14, ease: EASE_OUT } as const

const SWAP_BLUR = "blur(8px)"
const ROLL_BLUR = "blur(3px)"

const ICON_VARIANTS: Record<ActionSwapAnimation, Variants> = {
  blur: {
    initial: { opacity: 0, scale: 0.25, filter: SWAP_BLUR },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: BLUR_TRANSITION,
    },
    exit: {
      opacity: 0,
      scale: 0.25,
      filter: SWAP_BLUR,
      transition: BLUR_TRANSITION,
    },
  },
  roll: {
    initial: { opacity: 0, y: 12, filter: ROLL_BLUR },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: SPRING_SWAP,
    },
    exit: {
      opacity: 0,
      y: -12,
      filter: ROLL_BLUR,
      transition: ROLL_EXIT_TRANSITION,
    },
  },
}

/**
 * Swaps one icon for another in place. `mode="popLayout"` takes the outgoing
 * icon out of flow so both occupy the same grid cell mid-swap instead of
 * shoving each other sideways, and `overflow-hidden` clips the roll travel.
 *
 * `value` is what identifies the current icon — change it and the swap runs.
 */
export function ActionSwapIcon({
  value,
  children,
  animation = "blur",
  className,
}: {
  value: string
  children: ReactNode
  animation?: ActionSwapAnimation
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden",
        className
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${animation}-${value}`}
          aria-hidden
          variants={ICON_VARIANTS[animation]}
          initial={reduce ? false : "initial"}
          animate={
            reduce
              ? { opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }
              : "animate"
          }
          exit={reduce ? undefined : "exit"}
          className="col-start-1 row-start-1 inline-flex items-center justify-center will-change-[opacity,filter,transform]"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
