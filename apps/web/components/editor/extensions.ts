import { Extension, type CommandProps } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import StarterKit from "@tiptap/starter-kit"
import { TextStyleKit } from "@tiptap/extension-text-style"
import TextAlign from "@tiptap/extension-text-align"
import Highlight from "@tiptap/extension-highlight"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import { TableKit } from "@tiptap/extension-table"
import Image from "@tiptap/extension-image"
import { CharacterCount, Placeholder } from "@tiptap/extensions"
import { DEFAULT_LINE_SPACING } from "./document-options"
import { MergeField } from "./merge-field"
import { Pagination } from "./pagination"
import { PasteInline } from "./paste"
import { TableSelection } from "./table-selection"

/** Word's default indent step (1.27 cm). */
const INDENT_STEP_PX = 48
const MAX_INDENT = 8

const BLOCK_TYPES = ["paragraph", "heading"]

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Moves the selected blocks one step to the right (or sinks a list item). */
      indent: () => ReturnType
      /** Moves the selected blocks one step to the left (or lifts a list item). */
      outdent: () => ReturnType
    }
    lineSpacing: {
      /** Sets the line height of every paragraph and heading in the selection. */
      setLineSpacing: (value: string) => ReturnType
    }
    listStyle: {
      /** Sets `list-style-type` on the bullet lists in the selection. */
      setBulletStyle: (style: string) => ReturnType
      /** Sets `list-style-type` on the ordered lists in the selection. */
      setNumberStyle: (style: string) => ReturnType
    }
  }
}

/**
 * Rewrites the attributes of every paragraph and heading in the selection.
 * `update` returns the new attributes, or null to leave a block untouched.
 */
function updateSelectedBlocks(
  { tr, state }: CommandProps,
  update: (node: PMNode) => Record<string, unknown> | null
): boolean {
  const { from, to } = state.selection
  let changed = false
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!BLOCK_TYPES.includes(node.type.name)) return
    const attrs = update(node)
    if (!attrs) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
    changed = true
  })
  return changed
}

function shiftIndent(delta: 1 | -1) {
  return (props: CommandProps): boolean => {
    const { editor, commands } = props
    if (editor.isActive("listItem")) {
      return delta === 1
        ? commands.sinkListItem("listItem")
        : commands.liftListItem("listItem")
    }
    return updateSelectedBlocks(props, (node) => {
      const current = Number(node.attrs.indent ?? 0)
      const indent = Math.max(0, Math.min(MAX_INDENT, current + delta))
      return indent === current ? null : { indent }
    })
  }
}

/**
 * Paragraph-level indentation, rendered as a left margin. Tab/Shift+Tab fall
 * through to the list commands when the cursor is inside a list.
 */
export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const px = Number.parseFloat(element.style.marginLeft || "0")
              if (!Number.isFinite(px) || px <= 0) return 0
              return Math.min(MAX_INDENT, Math.round(px / INDENT_STEP_PX))
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent ?? 0)
              return indent > 0
                ? { style: `margin-left: ${indent * INDENT_STEP_PX}px` }
                : {}
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent: () => shiftIndent(1),
      outdent: () => shiftIndent(-1),
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    }
  },
})

/**
 * Block-level line spacing (a paragraph property, like in Word) rather than
 * the inline text-style variant Tiptap ships by default.
 */
export const LineSpacing = Extension.create({
  name: "lineSpacing",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight
                ? { style: `line-height: ${attributes.lineHeight}` }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineSpacing: (value) => (props) => {
        const lineHeight = value === DEFAULT_LINE_SPACING ? null : value
        return updateSelectedBlocks(props, (node) =>
          node.attrs.lineHeight === lineHeight ? null : { lineHeight }
        )
      },
    }
  },
})

/** Bullet and numbering styles via `list-style-type`. */
export const ListStyle = Extension.create({
  name: "listStyle",

  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          listStyleType: {
            default: null,
            parseHTML: (element) => element.style.listStyleType || null,
            renderHTML: (attributes) =>
              attributes.listStyleType
                ? { style: `list-style-type: ${attributes.listStyleType}` }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setBulletStyle:
        (style) =>
        ({ chain, editor }) => {
          const base = editor.isActive("bulletList")
            ? chain()
            : chain().toggleBulletList()
          return base
            .updateAttributes("bulletList", { listStyleType: style })
            .run()
        },
      setNumberStyle:
        (style) =>
        ({ chain, editor }) => {
          const base = editor.isActive("orderedList")
            ? chain()
            : chain().toggleOrderedList()
          return base
            .updateAttributes("orderedList", { listStyleType: style })
            .run()
        },
    }
  },
})

type DraftExtensionOptions = {
  /**
   * `false` builds the page header and footer editors, which share the body's
   * formatting but live inside a single margin and never break.
   */
  paginate?: boolean
  /** Names a merge field in the reader's language. */
  fieldLabel: (key: string) => string
}

export function createDraftExtensions(
  placeholder: string,
  { paginate = true, fieldLabel }: DraftExtensionOptions
) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
      undoRedo: { depth: 500 },
    }),
    // Line height is a block property here (see LineSpacing), so drop the inline variant.
    TextStyleKit.configure({ lineHeight: false }),
    // No default alignment: unaligned blocks follow the page's left alignment,
    // so wrapped lines keep their natural word spacing unless Justify is picked.
    TextAlign.configure({ types: BLOCK_TYPES }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TableKit.configure({
      table: { resizable: true, lastColumnResizable: false },
    }),
    TableSelection,
    PasteInline,
    Image.configure({ allowBase64: true, inline: false }),
    CharacterCount,
    Placeholder.configure({ placeholder }),
    Indent,
    LineSpacing,
    ListStyle,
    MergeField.configure({ label: fieldLabel }),
    // The canvas supplies the sheet geometry once it knows the page setup.
    ...(paginate ? [Pagination] : []),
  ]
}
