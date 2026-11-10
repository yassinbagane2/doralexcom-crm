// Page sizes and margins. Everything is expressed in CSS pixels at 96 DPI
// so the page, the rulers and the pagination maths all agree.

/** CSS pixels per centimetre at 96 DPI. */
export const CM = 96 / 2.54

export const PAGE_SIZES = {
  a4: { label: "A4", widthCm: 21, heightCm: 29.7 },
  a5: { label: "A5", widthCm: 14.8, heightCm: 21 },
  letter: { label: "US Letter", widthCm: 21.59, heightCm: 27.94 },
  legal: { label: "US Legal", widthCm: 21.59, heightCm: 35.56 },
} as const
export type PageSizeId = keyof typeof PAGE_SIZES
export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES) as PageSizeId[]

export const PAGE_MARGINS = {
  normal: { label: "Normal", cm: 2.54 },
  narrow: { label: "Narrow", cm: 1.27 },
  moderate: { label: "Moderate", cm: 1.91 },
  wide: { label: "Wide", cm: 5.08 },
} as const
export type PageMarginId = keyof typeof PAGE_MARGINS
export const PAGE_MARGIN_IDS = Object.keys(PAGE_MARGINS) as PageMarginId[]

export type PageOrientation = "portrait" | "landscape"

export type PageSetup = {
  size: PageSizeId
  orientation: PageOrientation
  /** Preset for the top and bottom margins, and for the sides unless `sideMargin` is set. */
  margin: PageMarginId
  /** Left and right margin (always equal) set on the ruler, in cm; `null` while the preset applies. */
  sideMargin: number | null
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  size: "a4",
  orientation: "portrait",
  margin: "normal",
  sideMargin: null,
}

/** A length in centimetres as shown to the user: up to two decimals, no trailing zeros. */
export const formatCm = (cm: number) => String(Math.round(cm * 100) / 100)

/** The body never gets narrower than this, however far the side margins are dragged. */
export const MIN_TEXT_WIDTH_CM = 2

/** Widest side margin a page allows: both sides together leave `MIN_TEXT_WIDTH_CM` for text. */
export const maxSideMargin = (pageWidthCm: number) =>
  Math.max(0, (pageWidthCm - MIN_TEXT_WIDTH_CM) / 2)

/** A side margin kept on the paper: never negative, never past `maxSideMargin`. */
export const clampSideMargin = (cm: number, pageWidthCm: number) =>
  Math.min(Math.max(cm, 0), maxSideMargin(pageWidthCm))

/** Page setup saved by an older or newer editor falls back to the defaults it doesn't know. */
export function toPageSetup(raw: {
  size: string
  orientation: PageOrientation
  margin: string
  sideMargin?: number | null
}): PageSetup {
  const side = raw.sideMargin
  return {
    size: PAGE_SIZE_IDS.includes(raw.size as PageSizeId)
      ? (raw.size as PageSizeId)
      : DEFAULT_PAGE_SETUP.size,
    orientation: raw.orientation,
    margin: PAGE_MARGIN_IDS.includes(raw.margin as PageMarginId)
      ? (raw.margin as PageMarginId)
      : DEFAULT_PAGE_SETUP.margin,
    sideMargin:
      typeof side === "number" && Number.isFinite(side) && side >= 0
        ? side
        : null,
  }
}

/** One length per side of the page. */
export type Margins = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PageDimensions = {
  widthCm: number
  heightCm: number
  widthPx: number
  heightPx: number
  marginCm: Margins
  marginPx: Margins
}

export function getPageDimensions(setup: PageSetup): PageDimensions {
  const size = PAGE_SIZES[setup.size]
  const [widthCm, heightCm] =
    setup.orientation === "portrait"
      ? [size.widthCm, size.heightCm]
      : [size.heightCm, size.widthCm]
  const presetCm = PAGE_MARGINS[setup.margin].cm
  // Clamped again here in case the paper got narrower since the sides were dragged.
  const side = clampSideMargin(setup.sideMargin ?? presetCm, widthCm)
  const marginCm = { top: presetCm, right: side, bottom: presetCm, left: side }
  return {
    widthCm,
    heightCm,
    widthPx: widthCm * CM,
    heightPx: heightCm * CM,
    marginCm,
    marginPx: {
      top: marginCm.top * CM,
      right: marginCm.right * CM,
      bottom: marginCm.bottom * CM,
      left: marginCm.left * CM,
    },
  }
}
