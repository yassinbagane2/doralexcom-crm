// Option catalogues the editor chrome is built from: fonts, sizes, spacing,
// paragraph styles, document themes, colours and list styles. Labels shown to
// the reader live in the "Editor" messages, keyed by each option's id.

import type { CSSProperties } from "react"

export type DocumentFont = { label: string; value: string }

/** Font names stay as they are in every language. */
export const DOCUMENT_FONTS: readonly DocumentFont[] = [
  { label: "Calibri", value: "Calibri, Carlito, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Garamond", value: "Garamond, 'EB Garamond', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
]

export function findFontByValue(
  value: string | undefined
): DocumentFont | undefined {
  if (!value) return undefined
  const normalised = value.replace(/["']/g, "").toLowerCase()
  return DOCUMENT_FONTS.find(
    (font) => font.value.replace(/["']/g, "").toLowerCase() === normalised
  )
}

export const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72,
] as const
export const DEFAULT_FONT_SIZE = 11
export const MIN_FONT_SIZE = 1
export const MAX_FONT_SIZE = 400

/** Parses "11pt" / "14.5pt" into a number of points; anything else yields undefined. */
export function parseFontSize(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = /^(\d+(?:\.\d+)?)pt$/.exec(value.trim())
  return match ? Number(match[1]) : undefined
}

export function nextFontSize(current: number, direction: 1 | -1): number {
  if (direction === 1) {
    const larger = FONT_SIZES.find((size) => size > current)
    return Math.min(MAX_FONT_SIZE, larger ?? current + 1)
  }
  const smaller = [...FONT_SIZES].reverse().find((size) => size < current)
  return Math.max(MIN_FONT_SIZE, smaller ?? current - 1)
}

export const LINE_SPACINGS = ["1", "1.15", "1.5", "2", "2.5", "3"] as const
export type LineSpacing = (typeof LINE_SPACINGS)[number]
export const DEFAULT_LINE_SPACING: LineSpacing = "1.15"

export type TextStyleId =
  | "paragraph"
  | "title"
  | "heading1"
  | "heading2"
  | "heading3"

export type TextStyleOption = {
  id: TextStyleId
  /** Heading level the style maps to, or null for a plain paragraph. */
  level: 1 | 2 | 3 | 4 | null
  /** Points, as in draft-editor.css. */
  size: number
}

export const TEXT_STYLES: readonly TextStyleOption[] = [
  { id: "paragraph", level: null, size: DEFAULT_FONT_SIZE },
  { id: "title", level: 1, size: 26 },
  { id: "heading1", level: 2, size: 18 },
  { id: "heading2", level: 3, size: 14 },
  { id: "heading3", level: 4, size: 12 },
]

export type DocumentThemeId = "default" | "classic" | "modern" | "elegant"

export type DocumentTheme = {
  id: DocumentThemeId
  bodyFont: string
  headingFont: string
  accent: string
}

export const DOCUMENT_THEMES: readonly DocumentTheme[] = [
  {
    id: "default",
    bodyFont: "Calibri, Carlito, sans-serif",
    headingFont: "Calibri, Carlito, sans-serif",
    accent: "#1f2937",
  },
  {
    id: "classic",
    bodyFont: "'Times New Roman', Times, serif",
    headingFont: "'Times New Roman', Times, serif",
    accent: "#1e3a5f",
  },
  {
    id: "modern",
    bodyFont: "Arial, Helvetica, sans-serif",
    headingFont: "Verdana, Geneva, sans-serif",
    accent: "#0f766e",
  },
  {
    id: "elegant",
    bodyFont: "Garamond, 'EB Garamond', serif",
    headingFont: "Georgia, serif",
    accent: "#7c2d12",
  },
]
export const DEFAULT_THEME = DOCUMENT_THEMES[0]!

/** The theme a document was saved with; an unknown or missing id falls back to the default. */
export const themeById = (id: string | undefined): DocumentTheme =>
  DOCUMENT_THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME

/** The CSS variables `draft-editor.css` reads a theme from; set them on `.draft-page`. */
export const themeCssVars = (theme: DocumentTheme): CSSProperties =>
  ({
    "--doc-body-font": theme.bodyFont,
    "--doc-heading-font": theme.headingFont,
    "--doc-accent": theme.accent,
  }) as CSSProperties

/** `id` names the colour in the "Editor.colors" messages. */
export type ColorSwatch = { id: string; value: string }

export const TEXT_COLORS: readonly ColorSwatch[] = [
  { id: "black", value: "#000000" },
  { id: "darkGray", value: "#404040" },
  { id: "gray", value: "#737373" },
  { id: "lightGray", value: "#a3a3a3" },
  { id: "silver", value: "#d4d4d4" },
  { id: "white", value: "#ffffff" },
  { id: "red", value: "#dc2626" },
  { id: "orange", value: "#ea580c" },
  { id: "amber", value: "#d97706" },
  { id: "green", value: "#16a34a" },
  { id: "teal", value: "#0d9488" },
  { id: "blue", value: "#2563eb" },
  { id: "indigo", value: "#4f46e5" },
  { id: "purple", value: "#7c3aed" },
  { id: "pink", value: "#db2777" },
  { id: "darkRed", value: "#7f1d1d" },
  { id: "brown", value: "#78350f" },
  { id: "darkGreen", value: "#14532d" },
  { id: "navy", value: "#1e3a8a" },
  { id: "plum", value: "#4c1d95" },
]

export const HIGHLIGHT_COLORS: readonly ColorSwatch[] = [
  { id: "yellow", value: "#fef08a" },
  { id: "green", value: "#bbf7d0" },
  { id: "blue", value: "#bae6fd" },
  { id: "pink", value: "#fbcfe8" },
  { id: "orange", value: "#fed7aa" },
  { id: "purple", value: "#ddd6fe" },
  { id: "teal", value: "#99f6e4" },
  { id: "gray", value: "#e5e7eb" },
]

export const DEFAULT_HIGHLIGHT = HIGHLIGHT_COLORS[0]!.value

/** Labelled by the "Editor.bulletStyles" messages. */
export const BULLET_STYLES = ["disc", "circle", "square"] as const

/** Shown as they print, so the same in every language. */
export const NUMBER_STYLES = [
  { id: "decimal", label: "1. 2. 3." },
  { id: "lower-alpha", label: "a. b. c." },
  { id: "upper-alpha", label: "A. B. C." },
  { id: "lower-roman", label: "i. ii. iii." },
  { id: "upper-roman", label: "I. II. III." },
] as const
