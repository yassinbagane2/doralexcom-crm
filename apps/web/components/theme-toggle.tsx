"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { ActionSwapIcon } from "@workspace/ui/components/motion/action-swap"
import { Moon, Sun } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useSyncExternalStore } from "react"

/**
 * Light/dark switch, ported from the reservi app (itself from
 * beui.dev/components/motion/theme-toggle).
 *
 * The old theme is left in place and the new one is revealed over it with a
 * View Transition, so the swap reads as one surface arriving rather than every
 * element recolouring at once. The reveal shape is CSS on the
 * `::view-transition-new(root)` pseudo-element, keyed off a `data-beui-vt`
 * attribute the toggle sets on `html` for the duration of the transition.
 *
 * Browsers without `startViewTransition`, and anyone who prefers reduced
 * motion, get the plain instant switch.
 */

export type ThemeVariant = "rectangle" | "circle" | "circle-blur" | "blinds"

export type RectStart =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "bottom-up"

const VT_STYLE_ID = "beui-theme-toggle-vt"

/*
 * Injected at runtime rather than living in globals.css: it's only meaningful
 * while a toggle is mounted, and keeping it next to the variants it describes
 * means the two can't drift apart.
 *
 * Every variant kills the default cross-fade on `-old(root)` — the outgoing
 * theme has to sit still underneath, or the reveal fades into a blank page. The
 * easing literal mirrors `--ease-out-expo`; it's spelled out because these
 * rules live outside the Tailwind layer that defines the token.
 */
const VT_CSS = `
html[data-beui-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-rect-reveal 400ms ease-out;
}
html[data-beui-vt="circle"]::view-transition-old(root),
html[data-beui-vt="circle-blur"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="circle"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="circle-blur"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-blur-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="blinds"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
@property --beui-vt-slat {
  syntax: "<length>";
  inherits: false;
  initial-value: 72px;
}
html[data-beui-vt="blinds"]::view-transition-new(root) {
  mix-blend-mode: normal;
  mask-image: linear-gradient(
    90deg,
    #000 0 var(--beui-vt-slat),
    transparent calc(var(--beui-vt-slat) + 20px)
  );
  mask-size: 72px 100%;
  mask-repeat: repeat;
  animation: beui-blinds-reveal 700ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes beui-rect-reveal {
  from { clip-path: var(--beui-vt-from, inset(100% 0 0 0)); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes beui-circle-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); }
}
@keyframes beui-circle-blur-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); filter: blur(8px); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); filter: blur(0px); }
}
@keyframes beui-blinds-reveal {
  from { --beui-vt-slat: -20px; }
  to   { --beui-vt-slat: 72px; }
}
`

const RECT_FROM: Record<RectStart, string> = {
  "top-left": "inset(0 100% 100% 0)",
  "top-right": "inset(0 0 100% 100%)",
  "bottom-left": "inset(100% 100% 0 0)",
  "bottom-right": "inset(100% 0 0 100%)",
  center: "inset(50% 50% 50% 50%)",
  "bottom-up": "inset(100% 0 0 0)",
}

const CIRCLE_ORIGIN: Record<RectStart, string> = {
  "top-left": "0% 0%",
  "top-right": "100% 0%",
  "bottom-left": "0% 100%",
  "bottom-right": "100% 100%",
  center: "50% 50%",
  "bottom-up": "50% 100%",
}

/*
 * Defaults for this app rather than beui's: the toggle lives in the top-right
 * of the header, so the circle grows out of roughly where the pointer just was.
 */
const DEFAULT_VARIANT: ThemeVariant = "circle-blur"
const DEFAULT_START: RectStart = "top-right"

/*
 * Hydration flag. `useSyncExternalStore` with a store that never changes gives
 * false on the server and true on the client for free.
 */
const neverChanges = () => () => {}
const onClient = () => true
const onServer = () => false

/**
 * The toggle behaviour on its own, for any control that wants the same reveal.
 *
 * `mounted` exists because the server can't know the resolved theme — until
 * hydration there's no honest answer to "which icon", and rendering one anyway
 * would either mismatch or flip on the first frame.
 */
export function useThemeToggle({
  variant = DEFAULT_VARIANT,
  start = DEFAULT_START,
}: { variant?: ThemeVariant; start?: RectStart } = {}) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(neverChanges, onClient, onServer)

  useEffect(() => {
    if (document.getElementById(VT_STYLE_ID)) {
      return
    }

    const style = document.createElement("style")
    style.id = VT_STYLE_ID
    style.textContent = VT_CSS
    document.head.appendChild(style)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark"
    // Read at click time: no motion dependency in this app, and it follows a
    // preference changed while the page is open.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (reduce || !("startViewTransition" in document)) {
      setTheme(next)
      return
    }

    const root = document.documentElement

    if (variant === "rectangle") {
      root.style.setProperty("--beui-vt-from", RECT_FROM[start])
      root.dataset.beuiVt = "rect"
    } else if (variant === "blinds") {
      root.dataset.beuiVt = "blinds"
    } else {
      root.style.setProperty("--beui-vt-origin", CIRCLE_ORIGIN[start])
      root.dataset.beuiVt = variant
    }

    const transition = (
      document as Document & {
        startViewTransition(callback: () => void): { finished: Promise<void> }
      }
    ).startViewTransition(() => setTheme(next))

    // Cleared on `finished` rather than immediately: the attribute is what
    // selects the keyframes, so removing it early cancels the reveal.
    void transition.finished.finally(() => {
      delete root.dataset.beuiVt
    })
  }, [isDark, setTheme, start, variant])

  return { isDark, mounted, toggle }
}

/** Light/dark button for headers and the preferences page. */
export function ThemeToggle({
  variant = DEFAULT_VARIANT,
  start = DEFAULT_START,
  className,
  iconClassName,
}: {
  variant?: ThemeVariant
  start?: RectStart
  className?: string
  iconClassName?: string
}) {
  const t = useTranslations("Theme")
  const { isDark, mounted, toggle } = useThemeToggle({ variant, start })

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("rounded-full text-muted-foreground", className)}
      aria-label={isDark ? t("switchToLight") : t("switchToDark")}
      onClick={toggle}
    >
      {mounted ? (
        <ActionSwapIcon
          value={isDark ? "dark" : "light"}
          animation="blur"
          className={cn("size-4", iconClassName)}
        >
          {isDark ? (
            <Sun className={cn("size-4", iconClassName)} />
          ) : (
            <Moon className={cn("size-4", iconClassName)} />
          )}
        </ActionSwapIcon>
      ) : (
        // Holds the icon's box before hydration so the bar doesn't reflow.
        <span className={cn("size-4", iconClassName)} aria-hidden />
      )}
    </Button>
  )
}
