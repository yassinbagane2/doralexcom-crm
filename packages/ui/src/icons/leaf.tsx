"use client"

import { useState } from "react"
import {
  m,
  LazyMotion,
  domAnimation,
  SVGMotionProps,
  Easing,
} from "motion/react"

interface LeafIconProps extends SVGMotionProps<SVGSVGElement> {
  size?: number
  duration?: number
  strokeWidth?: number
  isHovered?: boolean
  ease?: Easing
}

export const Leaf = (props: LeafIconProps) => {
  const {
    size = 28,
    duration = 1.5,
    strokeWidth = 1.5,
    isHovered = true,
    ease = "easeInOut",
    className,
    ...restProps
  } = props

  const [isHoveredInternal, setIsHoveredInternal] = useState(false)

  const shouldAnimate = isHovered ? isHoveredInternal : true

  const swayProps = {
    animate: shouldAnimate ? { rotate: [0, -5, 5, -3, 3, 0] } : { rotate: 0 },
    transition: {
      duration: duration,
      ease: ease,
      repeat: isHovered ? 0 : Infinity,
    },
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.svg
        {...restProps}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        overflow="visible"
        onMouseEnter={() => isHovered && setIsHoveredInternal(true)}
        onMouseLeave={() => isHovered && setIsHoveredInternal(false)}
        {...swayProps}
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M12 10a6 6 0 0 0 -6 -6h-3v2a6 6 0 0 0 6 6h3" />
        <path d="M12 14a6 6 0 0 1 6 -6h3v1a6 6 0 0 1 -6 6h-3" />
        <path d="M12 20l0 -10" />
      </m.svg>
    </LazyMotion>
  )
}
