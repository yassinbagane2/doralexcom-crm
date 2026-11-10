// Mouse selections that cross a table edge. prosemirror-tables only builds a
// cell selection for drags that start inside a cell; a drag that starts in the
// text above or below a table is read back from the browser as a text range
// ending inside a cell, which its selection normaliser then shrinks to one
// cell (or nothing, in an empty table) the moment the mouse is released. Here
// such ranges are widened the way Word does: a range with one end outside a
// table covers the whole table, and a range between two cells of the same
// table becomes a cell selection. A drag that starts just above a table is
// anchored on the table itself rather than in a cell; that end counts as the
// nearest cell, so the drag selects cells instead of collapsing to a caret on
// release. Tables fully inside a text selection get the cell highlight too,
// since empty cells show almost no native highlight.

import { Extension } from "@tiptap/core"
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model"
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
} from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  CellSelection,
  TableMap,
  cellAround,
  tableEditingKey,
} from "@tiptap/pm/tables"

/** Depth of the innermost table around `$pos`, or -1 outside tables. */
function tableDepth($pos: ResolvedPos): number {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.spec.tableRole === "table") return depth
  }
  return -1
}

/** Nearest text position past the table at `depth`, going in `dir`. */
function pastTable(doc: PMNode, $pos: ResolvedPos, depth: number, dir: 1 | -1) {
  const edge = dir > 0 ? $pos.after(depth) : $pos.before(depth)
  return Selection.findFrom(doc.resolve(edge), dir, true)?.$head ?? null
}

/**
 * The cell around `$pos` in the table at `depth`. A position inside the table
 * but outside every cell, where a drag that starts on the table's edge (or in
 * the gap just above it) is anchored, snaps to the nearest cell in `dir`.
 */
function cellNear(
  $pos: ResolvedPos,
  depth: number,
  dir: 1 | -1
): ResolvedPos | null {
  const inside = cellAround($pos)
  if (inside) return inside
  const found = Selection.findFrom($pos, dir, true)
  const cell = found ? cellAround(found.$head) : null
  return cell && cell.start(-1) === $pos.start(depth) ? cell : null
}

/** Every cell of the table at `depth` around `$pos`. */
function wholeTable(
  doc: PMNode,
  $pos: ResolvedPos,
  depth: number
): CellSelection {
  const start = $pos.start(depth)
  const { map } = TableMap.get($pos.node(depth))
  return CellSelection.create(
    doc,
    start + map[0]!,
    start + map[map.length - 1]!
  )
}

function selectionAcrossTables(
  doc: PMNode,
  $anchor: ResolvedPos,
  $head: ResolvedPos
): Selection | null {
  const anchorDepth = tableDepth($anchor)
  const headDepth = tableDepth($head)
  if (anchorDepth < 0 && headDepth < 0) return null

  const dir = $head.pos >= $anchor.pos ? 1 : -1
  const sameTable =
    anchorDepth >= 0 &&
    headDepth >= 0 &&
    $anchor.before(anchorDepth) === $head.before(headDepth)
  if (sameTable) {
    const anchorCell = cellNear($anchor, anchorDepth, dir)
    const headCell = cellNear($head, headDepth, dir > 0 ? -1 : 1)
    if (!anchorCell || !headCell || anchorCell.pos === headCell.pos) return null
    return new CellSelection(anchorCell, headCell)
  }

  // Push each end that sits in a table out past that table, away from the other end.
  let anchor = $anchor
  let head = $head
  if (anchorDepth >= 0) {
    const past = pastTable(doc, $anchor, anchorDepth, dir > 0 ? -1 : 1)
    // No text beyond the table (it starts or ends the document): select just the table.
    if (!past) return wholeTable(doc, $anchor, anchorDepth)
    anchor = past
  }
  if (headDepth >= 0) {
    const past = pastTable(doc, $head, headDepth, dir)
    if (!past) return wholeTable(doc, $head, headDepth)
    head = past
  }
  return new TextSelection(anchor, head)
}

const TABLE_SELECTED_CLASS = "draft-table-selected"

/** Marks every table that a text (or select-all) selection covers end to end. */
function coveredTableDecorations(state: EditorState): DecorationSet | null {
  const { selection, doc } = state
  if (selection.empty || selection instanceof CellSelection) return null
  const decorations: Decoration[] = []
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (node.type.spec.tableRole !== "table") return true
    const end = pos + node.nodeSize
    if (selection.from <= pos && end <= selection.to) {
      decorations.push(
        Decoration.node(pos, end, { class: TABLE_SELECTED_CLASS })
      )
    }
    return false
  })
  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : null
}

/** The mouse drag in progress, and where it was anchored if that was on a table's edge. */
type Drag = { doc: PMNode; anchor: number | null | undefined }

function createTableSelectionPlugin() {
  let drag: Drag | null = null
  const endDrag = () => {
    drag = null
  }

  return new Plugin({
    key: new PluginKey("tableSelection"),
    props: {
      decorations: coveredTableDecorations,
      handleDOMEvents: {
        mousedown(view, event) {
          if (event.button !== 0) return false
          drag = { doc: view.state.doc, anchor: undefined }
          view.root.addEventListener("mouseup", endDrag, { once: true })
          return false
        },
      },
      createSelectionBetween(view, $anchor, $head) {
        // A drag that started in a cell is prosemirror-tables' own.
        if (tableEditingKey.getState(view.state) != null) return null
        // Once a drag from a table's edge becomes a cell selection, the view
        // writes that selection back to the browser, which then extends the
        // drag from the head cell. Keep the anchor where the drag started.
        if (drag && drag.doc === view.state.doc) {
          if (drag.anchor === undefined) {
            drag.anchor =
              tableDepth($anchor) >= 0 && !cellAround($anchor)
                ? $anchor.pos
                : null
          } else if (drag.anchor !== null) {
            $anchor = view.state.doc.resolve(drag.anchor)
          }
        }
        return selectionAcrossTables(view.state.doc, $anchor, $head)
      },
    },
  })
}

export const TableSelection = Extension.create({
  name: "tableSelection",

  addProseMirrorPlugins() {
    return [createTableSelectionPlugin()]
  },
})
