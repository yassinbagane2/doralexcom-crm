// Pure page-break computation. Everything is expressed in CSS pixels relative
// to the top of the editor's content box (the top of page 1's printable area),
// so the maths here is independent of where the page sits on screen. DOM
// access is abstracted behind `LayoutMeasurer`.

import type { Node as PMNode } from "@tiptap/pm/model"

/**
 * Vertical page layout the breaks are computed for. Width and side margins are
 * left out: they only change how text wraps, which the measurements pick up.
 */
export type PageGeometry = {
  pageHeight: number
  marginTop: number
  marginBottom: number
  /** Space between two sheets on the desk. */
  gap: number
}

export type PageBreak = {
  /** Document position the spacer is drawn before. */
  pos: number
  /**
   * `inline` spacers sit inside a textblock at the start of a line, splitting
   * the paragraph across the break. `block` spacers sit between blocks.
   */
  kind: "inline" | "block"
  /** Spacer height, in CSS pixels. */
  height: number
  /** Index of the page the spacer leads into: the first break leads into page index 1. */
  page: number
}

export type Rect = { top: number; bottom: number }

export interface LayoutMeasurer {
  /** Border box of the block node at `pos`, or null when it has no DOM. */
  blockRect(pos: number): Rect | null
  /** Bottom of the content box of the textblock at `pos`. */
  textblockContentBottom(pos: number, rect: Rect): number
  /**
   * Line box occupied by the inline position `pos` inside the textblock at
   * `blockPos`, or null when it cannot be measured.
   */
  lineRect(pos: number, blockPos: number): Rect | null
}

/** Slack allowed before a line is considered to overflow its page. */
const TOLERANCE = 0.5

export function usableHeight(geometry: PageGeometry): number {
  return geometry.pageHeight - geometry.marginTop - geometry.marginBottom
}

/** Distance from the top of one page to the top of the next. */
export function pageStride(geometry: PageGeometry): number {
  return geometry.pageHeight + geometry.gap
}

/** Two measured rects belong to the same line when they mostly overlap vertically. */
export function sameLine(a: Rect, b: Rect): boolean {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return overlap > 0.5 * Math.min(a.bottom - a.top, b.bottom - b.top)
}

export function sameBreaks(
  a: readonly PageBreak[],
  b: readonly PageBreak[]
): boolean {
  if (a.length !== b.length) return false
  return a.every((x, i) => {
    const y = b[i]!
    return (
      x.pos === y.pos &&
      x.kind === y.kind &&
      Math.abs(x.height - y.height) < 0.01
    )
  })
}

export function sameGeometry(a: PageGeometry, b: PageGeometry): boolean {
  return (
    a.pageHeight === b.pageHeight &&
    a.marginTop === b.marginTop &&
    a.marginBottom === b.marginBottom &&
    a.gap === b.gap
  )
}

/**
 * Walks the document in order and decides where each page ends. Blocks that
 * fit on the current page are skipped wholesale; a block that straddles the
 * page bottom is broken at the first line that no longer fits (textblocks),
 * before the first row that no longer fits (tables) or before the block
 * itself (images, rules). A break that would land on the first line of a
 * block which is itself the first child of its parent (a list item, a quote)
 * is lifted to the outermost such ancestor so bullets and borders travel with
 * their content.
 */
export function computeBreaks(
  doc: PMNode,
  measurer: LayoutMeasurer,
  geometry: PageGeometry
): PageBreak[] {
  const usable = usableHeight(geometry)
  const stride = pageStride(geometry)
  if (usable <= 0) return []

  const breaks: PageBreak[] = []
  // Natural (spacer-free) y at which the current page's printable area ends.
  let limit = usable
  // Total height of the spacers inserted so far.
  let offset = 0
  // Whether anything has been placed on the current page yet.
  let unitsOnPage = 0

  const pushBreak = (
    pos: number,
    kind: PageBreak["kind"],
    naturalTop: number
  ) => {
    const page = breaks.length + 1
    const height = Math.max(0, page * stride - (naturalTop + offset))
    breaks.push({ pos, kind, height, page })
    offset += height
    limit = naturalTop + usable
    unitsOnPage = 1
  }

  const fits = (bottom: number) => bottom <= limit + TOLERANCE

  /** Smallest position in [lo, hi] whose line overflows the page, or null. */
  const firstOverflowing = (
    lo: number,
    hi: number,
    blockPos: number
  ): number | null => {
    const last = measurer.lineRect(hi, blockPos)
    if (!last || fits(last.bottom)) return null
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const rect = measurer.lineRect(mid, blockPos)
      if (rect && !fits(rect.bottom)) hi = mid
      else lo = mid + 1
    }
    return hi
  }

  /** Smallest position in [lo, pos] on the same line as `pos`. */
  const lineStart = (lo: number, pos: number, blockPos: number): number => {
    const ref = measurer.lineRect(pos, blockPos)
    if (!ref) return pos
    let hi = pos
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const rect = measurer.lineRect(mid, blockPos)
      if (rect && sameLine(rect, ref)) hi = mid
      else lo = mid + 1
    }
    return hi
  }

  /** Smallest position in (pos, hi] on a later line than `pos`, or null. */
  const nextLineStart = (
    pos: number,
    hi: number,
    blockPos: number
  ): number | null => {
    const ref = measurer.lineRect(pos, blockPos)
    const last = measurer.lineRect(hi, blockPos)
    if (!ref || !last || sameLine(last, ref)) return null
    let lo = pos + 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const rect = measurer.lineRect(mid, blockPos)
      if (rect && !sameLine(rect, ref)) hi = mid
      else lo = mid + 1
    }
    return hi
  }

  const breakBeforeAnchor = (anchor: number, fallback: Rect) => {
    const top = (measurer.blockRect(anchor) ?? fallback).top
    pushBreak(anchor, "block", top)
  }

  const visitTextblock = (
    node: PMNode,
    pos: number,
    anchor: number,
    rect: Rect
  ) => {
    const start = pos + 1
    const end = pos + node.nodeSize - 1
    const contentBottom = measurer.textblockContentBottom(pos, rect)
    let from = start
    for (;;) {
      if (fits(contentBottom)) {
        unitsOnPage += 1
        return
      }
      const overflowing = firstOverflowing(from, end, pos)
      if (overflowing === null) {
        unitsOnPage += 1
        return
      }
      const line = lineStart(from, overflowing, pos)
      if (line === start && unitsOnPage === 0) {
        // The page is empty and this line still does not fit: let it overflow.
        unitsOnPage = 1
      } else if (line === start && anchor !== pos) {
        breakBeforeAnchor(anchor, rect)
      } else {
        const lineBox = measurer.lineRect(line, pos)
        pushBreak(line, "inline", lineBox?.top ?? rect.top)
      }
      const next = nextLineStart(line, end, pos)
      if (next === null) return
      from = next
    }
  }

  const visitTable = (
    node: PMNode,
    pos: number,
    anchor: number,
    rect: Rect
  ) => {
    node.forEach((_row, rowOffset, rowIndex) => {
      const rowPos = pos + 1 + rowOffset
      const rowRect = measurer.blockRect(rowPos)
      if (!rowRect) return
      if (fits(rowRect.bottom)) {
        unitsOnPage += 1
        return
      }
      if (unitsOnPage === 0) {
        unitsOnPage = 1
        return
      }
      if (rowIndex === 0) breakBeforeAnchor(anchor, rect)
      else pushBreak(rowPos, "block", rowRect.top)
    })
  }

  const visitLeaf = (anchor: number, rect: Rect) => {
    if (unitsOnPage === 0) {
      unitsOnPage = 1
      return
    }
    breakBeforeAnchor(anchor, rect)
  }

  const visit = (node: PMNode, pos: number, anchor: number) => {
    const rect = measurer.blockRect(pos)
    if (!rect) return
    if (fits(rect.bottom)) {
      unitsOnPage += 1
      return
    }
    if (node.isTextblock) {
      visitTextblock(node, pos, anchor, rect)
    } else if (node.type.name === "table") {
      visitTable(node, pos, anchor, rect)
    } else if (node.isLeaf || node.isAtom || !node.firstChild?.isBlock) {
      visitLeaf(anchor, rect)
    } else {
      let index = 0
      node.forEach((child, childOffset) => {
        const childPos = pos + 1 + childOffset
        visit(child, childPos, index++ === 0 ? anchor : childPos)
      })
    }
  }

  doc.forEach((child, childOffset) => visit(child, childOffset, childOffset))
  return breaks
}
