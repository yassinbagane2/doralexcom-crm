import { mergeAttributes, Node } from "@tiptap/core"
import { MERGE_FIELD_NODE, type MergeFieldKey } from "@workspace/api/contract"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mergeField: {
      /** Inserts a field at the caret, replacing the selection. */
      insertMergeField: (key: MergeFieldKey) => ReturnType
    }
  }
}

export interface MergeFieldOptions {
  /** The field's name in the reader's language. */
  label: (key: string) => string
}

/**
 * A placeholder in a contract template, such as the tenant's name, that
 * fills in from the lease when a contract is generated (see
 * `fillMergeFields`). One unbreakable chip in the text: it takes marks like
 * bold, and the value it becomes keeps them.
 */
export const MergeField = Node.create<MergeFieldOptions>({
  name: MERGE_FIELD_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { label: (key) => key }
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-field"),
        renderHTML: (attributes) => ({ "data-field": attributes.key }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-field]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "draft-field" }),
      this.options.label(String(node.attrs.key)),
    ]
  },

  renderText({ node }) {
    return `«${this.options.label(String(node.attrs.key))}»`
  },

  addCommands() {
    return {
      insertMergeField:
        (key) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { key } }),
    }
  },
})
