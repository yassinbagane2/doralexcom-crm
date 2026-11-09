import type * as React from "react"

/** Props shared by the hand-authored SVG icons in this directory. */
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in px or any CSS length. Defaults to 24. */
  size?: number | string
}

/** Props for icons driven by an animation library. */
export interface AnimatedIconProps {
  size?: number | string
  color?: string
  strokeWidth?: number
  className?: string
}

/** Imperative handle exposed by animated icons. */
export interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}
