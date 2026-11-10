// Page layout for the drafting editor. The document stays one continuous
// ProseMirror flow; this extension measures where each page's printable area
// ends and inserts transparent spacer widgets there, so the text that follows
// starts exactly at the top of the next sheet. The canvas draws one sheet per
// page behind the editor and reads the page count from the plugin state.

import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import {
  computeBreaks,
  pageStride,
  sameBreaks,
  sameGeometry,
  type LayoutMeasurer,
  type PageBreak,
  type PageGeometry,
} from "./pagination-layout"

export type { PageBreak, PageGeometry } from "./pagination-layout"

export const PAGE_BREAK_CLASS = "draft-page-break"

type PaginationState = {
  geometry: PageGeometry | null
  breaks: PageBreak[]
  decorations: DecorationSet
  /** Bumped whenever a full re-measure is requested. */
  version: number
}

type PaginationMeta = {
  geometry?: PageGeometry
  breaks?: PageBreak[]
  repaginate?: boolean
}

export const paginationKey = new PluginKey<PaginationState>("pagination")

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagination: {
      /** Sets the sheet size, margins and gap the breaks are computed for. */
      setPageGeometry: (geometry: PageGeometry) => ReturnType
      /** Forces a re-measure, for layout changes that happen without a transaction (fonts). */
      repaginate: () => ReturnType
    }
  }
}

export function getPageBreaks(state: EditorState): readonly PageBreak[] {
  return paginationKey.getState(state)?.breaks ?? []
}

export function getPageCount(state: EditorState): number {
  return getPageBreaks(state).length + 1
}

/** 1-based page that holds the given document position. */
export function getPageAt(state: EditorState, pos: number): number {
  let page = 1
  for (const brk of getPageBreaks(state)) {
    if (brk.pos > pos) break
    page += 1
  }
  return page
}

function createSpacer(brk: PageBreak): HTMLElement {
  const el = document.createElement("div")
  el.className = PAGE_BREAK_CLASS
  el.dataset.kind = brk.kind
  el.style.height = `${brk.height}px`
  return el
}

function buildDecorations(
  doc: PMNode,
  breaks: readonly PageBreak[]
): DecorationSet {
  return DecorationSet.create(
    doc,
    breaks.map((brk) =>
      Decoration.widget(brk.pos, () => createSpacer(brk), {
        // Drawn before the caret at its position, so the caret lands on the new page.
        side: -1,
        marks: [],
        key: `${brk.kind}:${brk.page}:${brk.height.toFixed(2)}`,
      })
    )
  )
}

type BlockStyle = {
  lineHeight: number | null
  paddingBottom: number
  borderBottom: number
}

function createMeasurer(view: EditorView): LayoutMeasurer {
  const rootTop = view.dom.getBoundingClientRect().top
  const local = (y: number) => y - rootTop
  const styles = new Map<number, BlockStyle>()

  const blockStyle = (pos: number): BlockStyle => {
    const cached = styles.get(pos)
    if (cached) return cached
    let style: BlockStyle = {
      lineHeight: null,
      paddingBottom: 0,
      borderBottom: 0,
    }
    const dom = view.nodeDOM(pos)
    if (dom instanceof HTMLElement) {
      const computed = getComputedStyle(dom)
      const lineHeight = Number.parseFloat(computed.lineHeight)
      style = {
        lineHeight: Number.isFinite(lineHeight) ? lineHeight : null,
        paddingBottom: Number.parseFloat(computed.paddingBottom) || 0,
        borderBottom: Number.parseFloat(computed.borderBottomWidth) || 0,
      }
    }
    styles.set(pos, style)
    return style
  }

  return {
    blockRect(pos) {
      const dom = view.nodeDOM(pos)
      if (!(dom instanceof Element)) return null
      const rect = dom.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return null
      return { top: local(rect.top), bottom: local(rect.bottom) }
    },
    textblockContentBottom(pos, rect) {
      const style = blockStyle(pos)
      return rect.bottom - style.paddingBottom - style.borderBottom
    },
    lineRect(pos, blockPos) {
      let coords: { top: number; bottom: number }
      try {
        coords = view.coordsAtPos(pos, 1)
      } catch {
        return null
      }
      const top = local(coords.top)
      const bottom = local(coords.bottom)
      if (!(bottom > top)) return null
      // The caret rect is the glyph box; grow it by the half-leading to get the line box.
      const { lineHeight } = blockStyle(blockPos)
      if (lineHeight === null) return { top, bottom }
      const half = (lineHeight - (bottom - top)) / 2
      return { top: top - half, bottom: bottom + half }
    },
  }
}

/**
 * Re-measures the document after every change and keeps the spacer widgets in
 * step with it. Work is batched into an animation frame so a burst of
 * transactions costs one layout, and it runs before the browser paints, so the
 * intermediate state is never visible.
 */
class PaginationController {
  private frame: number | null = null
  private observer: ResizeObserver | null = null

  constructor(private readonly view: EditorView) {
    if (typeof ResizeObserver !== "undefined") {
      // Images loading, fonts swapping or the page width changing all reflow the text.
      this.observer = new ResizeObserver(this.schedule)
      this.observer.observe(view.dom)
    }
    view.dom.addEventListener("compositionend", this.schedule)
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(this.schedule, () => {})
    }
    this.schedule()
  }

  update(view: EditorView, prevState: EditorState) {
    const prev = paginationKey.getState(prevState)
    const next = paginationKey.getState(view.state)
    if (view.state.doc !== prevState.doc || prev?.version !== next?.version)
      this.schedule()
  }

  destroy() {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.observer?.disconnect()
    this.view.dom.removeEventListener("compositionend", this.schedule)
  }

  private schedule = () => {
    if (this.frame !== null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      this.run()
    })
  }

  private spacers(): HTMLElement[] {
    return Array.from(
      this.view.dom.querySelectorAll<HTMLElement>(`.${PAGE_BREAK_CLASS}`)
    )
  }

  private apply(breaks: PageBreak[]) {
    const { view } = this
    view.dispatch(
      view.state.tr
        .setMeta(paginationKey, { breaks })
        .setMeta("addToHistory", false)
    )
  }

  private run() {
    const { view } = this
    if (view.isDestroyed || !view.dom.isConnected || view.composing) return
    const state = paginationKey.getState(view.state)
    if (!state?.geometry) return
    const { geometry } = state

    // Measure the natural flow, with the current spacers taken out of the layout.
    const spacers = this.spacers()
    for (const el of spacers) el.style.display = "none"
    let breaks: PageBreak[]
    try {
      breaks = computeBreaks(view.state.doc, createMeasurer(view), geometry)
    } finally {
      for (const el of spacers) el.style.display = ""
    }

    if (!sameBreaks(breaks, state.breaks)) this.apply(breaks)
    this.correct(geometry)
  }

  /**
   * Spacer heights are estimated from caret rectangles; margins that stop
   * collapsing around a block spacer, or a line whose box is taller than its
   * first glyph, leave the next page a few pixels off. Measure where each
   * spacer actually put the content and nudge the heights until exact.
   */
  private correct(geometry: PageGeometry) {
    const stride = pageStride(geometry)
    for (let round = 0; round < 3; round++) {
      const state = paginationKey.getState(this.view.state)
      if (!state || state.breaks.length === 0) return
      const spacers = this.spacers()
      if (spacers.length !== state.breaks.length) return

      const rootTop = this.view.dom.getBoundingClientRect().top
      let applied = 0
      let changed = false
      const next = state.breaks.map((brk, index) => {
        const el = spacers[index]!
        const sibling = brk.kind === "block" ? el.nextElementSibling : null
        const following = sibling
          ? sibling.getBoundingClientRect().top
          : el.getBoundingClientRect().bottom
        const measured = following - rootTop
        // Earlier corrections already shift everything below them.
        const delta = brk.page * stride - measured - applied
        if (Math.abs(delta) <= 0.5) return brk
        changed = true
        applied += delta
        return { ...brk, height: Math.max(0, brk.height + delta) }
      })
      if (!changed) return
      this.apply(next)
    }
  }
}

function createPaginationPlugin(initial: PageGeometry | null) {
  return new Plugin<PaginationState>({
    key: paginationKey,
    state: {
      init: () => ({
        geometry: initial,
        breaks: [],
        decorations: DecorationSet.empty,
        version: 0,
      }),
      apply(tr, prev) {
        const meta = tr.getMeta(paginationKey) as PaginationMeta | undefined
        let next = prev
        if (
          meta?.geometry &&
          !(prev.geometry && sameGeometry(prev.geometry, meta.geometry))
        ) {
          next = { ...next, geometry: meta.geometry, version: next.version + 1 }
        }
        if (meta?.repaginate) next = { ...next, version: next.version + 1 }
        if (meta?.breaks) {
          next = {
            ...next,
            breaks: meta.breaks,
            decorations: buildDecorations(tr.doc, meta.breaks),
          }
        } else if (tr.docChanged && next.breaks.length > 0) {
          // Keep the spacers anchored until the next measurement replaces them.
          const breaks: PageBreak[] = []
          for (const brk of next.breaks) {
            const mapped = tr.mapping.mapResult(brk.pos, -1)
            if (mapped.deleted) continue
            breaks.push(
              mapped.pos === brk.pos ? brk : { ...brk, pos: mapped.pos }
            )
          }
          next = {
            ...next,
            breaks,
            decorations: next.decorations.map(tr.mapping, tr.doc),
          }
        }
        return next
      },
    },
    props: {
      decorations: (state) =>
        paginationKey.getState(state)?.decorations ?? DecorationSet.empty,
    },
    view: (view) => new PaginationController(view),
  })
}

export type PaginationOptions = {
  /** Initial geometry; the canvas normally sets it with `setPageGeometry`. */
  geometry: PageGeometry | null
}

export const Pagination = Extension.create<PaginationOptions>({
  name: "pagination",

  addOptions() {
    return { geometry: null }
  },

  addCommands() {
    return {
      setPageGeometry:
        (geometry) =>
        ({ state, tr, dispatch }) => {
          const current = paginationKey.getState(state)?.geometry
          if (current && sameGeometry(current, geometry)) return true
          if (dispatch)
            tr.setMeta(paginationKey, { geometry }).setMeta(
              "addToHistory",
              false
            )
          return true
        },
      repaginate:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch)
            tr.setMeta(paginationKey, { repaginate: true }).setMeta(
              "addToHistory",
              false
            )
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [createPaginationPlugin(this.options.geometry)]
  },
})
