"use client"

import type * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Sonner styled with the theme tokens. It takes `theme` as a prop instead of
 * reading next-themes itself, so this package stays framework-agnostic; the
 * app passes its resolved theme in.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
