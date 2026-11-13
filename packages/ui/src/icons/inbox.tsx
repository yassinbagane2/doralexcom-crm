"use client"

import { forwardRef, useImperativeHandle } from "react"
import type {
  AnimatedIconHandle,
  AnimatedIconProps,
} from "@workspace/ui/icons/types"
import { motion, useAnimate } from "motion/react"

/** An inbox tray; on hover the tray dips as if something just landed in it. */
const Inbox = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 24, className = "", strokeWidth = 2, color = "currentColor" },
    ref
  ) => {
    const [scope, animate] = useAnimate()

    const start = async () => {
      animate(".tray", { y: [0, 2, 0] }, { duration: 0.45, ease: "easeInOut" })
    }

    const stop = async () => {
      animate(".tray", { y: 0 }, { duration: 0.2, ease: "easeInOut" })
    }

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }))

    return (
      <motion.svg
        ref={scope}
        onHoverStart={start}
        onHoverEnd={stop}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        color={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`cursor-pointer ${className}`}
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <motion.path className="tray" d="M4 13h3l2 3h6l2-3h3" />
      </motion.svg>
    )
  }
)

Inbox.displayName = "Inbox"

export { Inbox }
