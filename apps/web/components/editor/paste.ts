import { Extension } from "@tiptap/core"
import { Slice, type Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"

/** A paragraph or heading holding nothing but whitespace and line breaks. */
function isBlank(node: PMNode): boolean {
  if (!node.isTextblock) return false
  let blank = true
  node.forEach((child) => {
    if (
      child.isText ? child.text!.trim() !== "" : child.type.name !== "hardBreak"
    )
      blank = false
  })
  return blank
}

function joinEdges(slice: Slice): Slice {
  let { content, openStart, openEnd } = slice
  const blocks: PMNode[] = []
  content.forEach((node) => blocks.push(node))
  // Inline text, tables and lists, or nothing but line breaks: paste as copied.
  if (blocks.every((node) => !node.isTextblock) || blocks.every(isBlank))
    return slice

  while (content.childCount > 1 && isBlank(content.lastChild!)) {
    content = content.cut(0, content.size - content.lastChild!.nodeSize)
    openEnd = 0
  }
  while (content.childCount > 1 && isBlank(content.firstChild!)) {
    content = content.cut(content.firstChild!.nodeSize)
    openStart = 0
  }
  if (openStart === 0 && content.firstChild!.isTextblock) openStart = 1
  if (openEnd === 0 && content.lastChild!.isTextblock) openEnd = 1
  return new Slice(content, openStart, openEnd)
}

export const PasteInline = Extension.create({
  name: "pasteInline",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pasteInline"),
        props: { transformPasted: joinEdges },
      }),
    ]
  },
})
