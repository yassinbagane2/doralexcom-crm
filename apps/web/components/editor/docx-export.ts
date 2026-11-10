// Word export: turns the editor's JSON (body, header and footer) into a .docx
// that looks like the page on screen. Runs in the browser, where images can be
// decoded to learn their size and formats Word cannot embed are re-encoded.
// Sizes follow Word's units: twips (1/20 pt) for layout, half-points for text.

import type { JSONContent } from "@tiptap/core"
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type ILevelsOptions,
  type IParagraphOptions,
  type IParagraphStyleOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx"
import type { DocumentTheme } from "./document-options"
import { CM, getPageDimensions, type PageSetup } from "./page-geometry"

export type DocxInput = {
  title: string
  body: JSONContent
  header: JSONContent | null
  footer: JSONContent | null
  pageSetup: PageSetup
  theme: DocumentTheme
  /** Who the document says created it (Word's "Author"). */
  creator?: string
}

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type Writable<T> = { -readonly [K in keyof T]: T[K] }
type ParagraphOptions = Writable<IParagraphOptions>
type RunOptions = Writable<IRunOptions>
/** A converted block: paragraph options are kept open until the end so list spacing can be patched. */
type Block = ParagraphOptions | Table

const TWIPS_PER_PX = 15
const TWIPS_PER_PT = 20
const TWIPS_PER_CM = 1440 / 2.54

/** Same as `getSheetLayout`: header and footer sit 1.25 cm (or half the margin) from the paper edge. */
const REGION_DISTANCE_PX = 1.25 * CM

// The editor's page styles (draft-editor.css), in Word units.
const BODY_SIZE = 22
const BODY_LINE = 276
const PARAGRAPH_AFTER = 8 * TWIPS_PER_PT
const LIST_ITEM_AFTER = 2 * TWIPS_PER_PT
const TEXT_COLOR = "1F2937"
const QUOTE_COLOR = "4B5563"
const RULE_COLOR = "D1D5DB"
const TABLE_BORDER_COLOR = "9CA3AF"
const CODE_SHADING = "F3F4F6"
const LINK_COLOR = "2563EB"
const DEFAULT_HIGHLIGHT = "FEF08A"
const MONO_FONT = "Courier New"
/** Word's indent step, the same 1.27 cm the editor's Indent extension uses. */
const INDENT_STEP = 720
const LIST_INDENT = 360
const MAX_LIST_LEVEL = 8

const HEADINGS = [
  {
    level: 1,
    id: "Heading1",
    heading: HeadingLevel.HEADING_1,
    size: 52,
    bold: false,
  },
  {
    level: 2,
    id: "Heading2",
    heading: HeadingLevel.HEADING_2,
    size: 36,
    bold: true,
  },
  {
    level: 3,
    id: "Heading3",
    heading: HeadingLevel.HEADING_3,
    size: 28,
    bold: true,
  },
  {
    level: 4,
    id: "Heading4",
    heading: HeadingLevel.HEADING_4,
    size: 24,
    bold: true,
  },
] as const

const ALIGNMENTS: Record<string, IParagraphOptions["alignment"]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

const BULLETS: Record<string, string> = { disc: "•", circle: "◦", square: "▪" }
const NUMBER_FORMATS: Record<string, ILevelsOptions["format"]> = {
  decimal: LevelFormat.DECIMAL,
  "lower-alpha": LevelFormat.LOWER_LETTER,
  "lower-latin": LevelFormat.LOWER_LETTER,
  "upper-alpha": LevelFormat.UPPER_LETTER,
  "upper-latin": LevelFormat.UPPER_LETTER,
  "lower-roman": LevelFormat.LOWER_ROMAN,
  "upper-roman": LevelFormat.UPPER_ROMAN,
}

const NAMED_COLORS: Record<string, string> = {
  black: "000000",
  white: "FFFFFF",
  red: "FF0000",
  green: "008000",
  blue: "0000FF",
  yellow: "FFFF00",
  orange: "FFA500",
  purple: "800080",
  gray: "808080",
  grey: "808080",
  silver: "C0C0C0",
  maroon: "800000",
  navy: "000080",
  teal: "008080",
  olive: "808000",
  lime: "00FF00",
  aqua: "00FFFF",
  fuchsia: "FF00FF",
}

const GENERIC_FONTS: Record<string, string> = {
  serif: "Times New Roman",
  "sans-serif": "Arial",
  monospace: "Courier New",
  "system-ui": "Arial",
  cursive: "Comic Sans MS",
}

/** Builds the Word file for a draft. */
export async function buildDocx(input: DocxInput): Promise<Blob> {
  const dims = getPageDimensions(input.pageSetup)
  const textWidthPx = dims.widthPx - dims.marginPx.left - dims.marginPx.right
  const images = await loadImages([input.body, input.header, input.footer])
  const converter = new Converter(images)
  const context: BlockContext = {
    indent: 0,
    quote: false,
    bold: false,
    list: null,
    maxWidthPx: textWidthPx,
  }

  const body = converter.blocks(input.body.content, context)
  const header = input.header && converter.blocks(input.header.content, context)
  const footer = input.footer && converter.blocks(input.footer.content, context)
  // The editor drops the last block's bottom margin inside the header and footer.
  if (header) trimLastSpacing(header)
  if (footer) trimLastSpacing(footer)

  const twips = (cm: number) => Math.round(cm * TWIPS_PER_CM)
  const { top, bottom } = dims.marginPx
  const distance = Math.round(
    Math.min(REGION_DISTANCE_PX, Math.min(top, bottom) / 2) * TWIPS_PER_PX
  )
  const landscape = input.pageSetup.orientation === "landscape"

  const document = new Document({
    title: input.title,
    creator: input.creator ?? "",
    styles: documentStyles(input.theme),
    numbering: { config: converter.numberingConfig() },
    // Like the browser, leave justified lines that end in a line break unstretched.
    compatibility: { doNotExpandShiftReturn: true },
    sections: [
      {
        properties: {
          page: {
            // docx swaps the sides itself for landscape, so pass the portrait size.
            size: {
              width: Math.round(
                Math.min(dims.widthCm, dims.heightCm) * TWIPS_PER_CM
              ),
              height: Math.round(
                Math.max(dims.widthCm, dims.heightCm) * TWIPS_PER_CM
              ),
              orientation: landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: {
              top: twips(dims.marginCm.top),
              right: twips(dims.marginCm.right),
              bottom: twips(dims.marginCm.bottom),
              left: twips(dims.marginCm.left),
              header: distance,
              footer: distance,
            },
          },
        },
        headers: header
          ? { default: new Header({ children: materialize(header) }) }
          : undefined,
        footers: footer
          ? { default: new Footer({ children: materialize(footer) }) }
          : undefined,
        children: materialize(body),
      },
    ],
  })

  return Packer.toBlob(document)
}

function documentStyles(theme: DocumentTheme) {
  const bodyFont = fontName(theme.bodyFont) ?? "Calibri"
  const headingFont = fontName(theme.headingFont) ?? bodyFont
  const accent = toHex(theme.accent) ?? TEXT_COLOR
  const headingRun = (heading: (typeof HEADINGS)[number]) => ({
    font: headingFont,
    size: heading.size,
    bold: heading.bold,
    color: accent,
  })
  const paragraphStyles: IParagraphStyleOptions[] = HEADINGS.map((heading) => ({
    id: heading.id,
    name: `Heading ${heading.level}`,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: headingRun(heading),
    paragraph: {
      keepNext: true,
      spacing: {
        before: heading.level === 1 ? 0 : 14 * TWIPS_PER_PT,
        after: 6 * TWIPS_PER_PT,
        line: 288,
        lineRule: LineRuleType.AUTO,
      },
    },
  }))
  return {
    default: {
      document: {
        run: { font: bodyFont, size: BODY_SIZE, color: TEXT_COLOR },
        paragraph: {
          spacing: {
            after: PARAGRAPH_AFTER,
            // Word counts "auto" line spacing in 240ths of a line.
            line: BODY_LINE,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    },
    paragraphStyles,
  }
}

// ---------------------------------------------------------------------------
// Blocks

type ListContext = { reference: string; instance: number; level: number }

type BlockContext = {
  /** Extra left indent from enclosing blockquotes, in twips. */
  indent: number
  /** Inside a blockquote: grey text and a rule on the left. */
  quote: boolean
  /** Inside a header cell, whose text is bold. */
  bold: boolean
  list: ListContext | null
  /** Width images and tables may take, in CSS pixels. */
  maxWidthPx: number
}

type ImageEntry = {
  data: Uint8Array
  type: "png" | "jpg" | "gif" | "bmp"
  width: number
  height: number
}

class Converter {
  private readonly lists = new Map<string, ILevelsOptions[]>()
  private instances = 0

  constructor(private readonly images: Map<string, ImageEntry | null>) {}

  numberingConfig() {
    return Array.from(this.lists, ([reference, levels]) => ({
      reference,
      levels,
    }))
  }

  blocks(nodes: JSONContent[] | undefined, context: BlockContext): Block[] {
    const blocks = (nodes ?? []).flatMap((node) => this.block(node, context))
    // Tables keep the editor's 8pt margin below them.
    blocks.forEach((block, index) => {
      const next = blocks[index + 1]
      if (block instanceof Table && next && !(next instanceof Table))
        next.spacing = { before: PARAGRAPH_AFTER, ...next.spacing }
    })
    return blocks
  }

  private block(node: JSONContent, context: BlockContext): Block[] {
    switch (node.type) {
      case "paragraph":
        return [this.paragraph(node, context)]
      case "heading":
        return [this.heading(node, context)]
      case "bulletList":
      case "orderedList":
        return this.list(node, context)
      case "blockquote":
        return this.blocks(node.content, {
          ...context,
          indent: context.indent + 16 * TWIPS_PER_PX,
          quote: true,
        })
      case "codeBlock":
        return [this.codeBlock(node, context)]
      case "horizontalRule":
        return [
          {
            ...this.layout(node, context),
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: RULE_COLOR,
                space: 1,
              },
            },
            spacing: { before: 12 * TWIPS_PER_PT, after: 12 * TWIPS_PER_PT },
          },
        ]
      case "image": {
        const run = this.image(node, context)
        return run ? [{ ...this.layout(node, context), children: [run] }] : []
      }
      case "table":
        return [this.table(node, context)]
      default:
        // Unknown nodes keep their text rather than disappearing.
        if (node.content?.some((child) => child.type === "text"))
          return [
            {
              ...this.layout(node, context),
              children: this.inline(node.content, context),
            },
          ]
        return this.blocks(node.content, context)
    }
  }

  private paragraph(
    node: JSONContent,
    context: BlockContext
  ): ParagraphOptions {
    return {
      ...this.layout(node, context),
      children: this.inline(node.content, context),
    }
  }

  private heading(node: JSONContent, context: BlockContext): ParagraphOptions {
    const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 4)
    return {
      ...this.layout(node, context),
      heading: HEADINGS[level - 1]!.heading,
      children: this.inline(node.content, context),
    }
  }

  /** Alignment, indent, line spacing, quote rule and list numbering shared by every paragraph. */
  private layout(node: JSONContent, context: BlockContext): ParagraphOptions {
    const options: ParagraphOptions = {}
    const align = node.attrs?.textAlign as string | undefined
    if (align && ALIGNMENTS[align]) options.alignment = ALIGNMENTS[align]

    const steps = Number(node.attrs?.indent ?? 0)
    const extra =
      context.indent + (Number.isFinite(steps) ? steps : 0) * INDENT_STEP
    if (context.list) {
      options.numbering = { ...context.list, custom: true }
      if (extra > 0)
        options.indent = {
          left: listIndent(context.list.level) + extra,
          hanging: LIST_INDENT,
        }
      options.spacing = { after: LIST_ITEM_AFTER }
    } else if (extra > 0) {
      options.indent = { left: extra }
    }

    const line = lineSpacing(node.attrs?.lineHeight as string | undefined)
    if (line) options.spacing = { ...options.spacing, ...line }

    if (context.quote) {
      options.border = {
        left: {
          style: BorderStyle.SINGLE,
          size: 18,
          color: RULE_COLOR,
          space: 8,
        },
      }
    }
    return options
  }

  private list(node: JSONContent, context: BlockContext): Block[] {
    const ordered = node.type === "orderedList"
    const style =
      (node.attrs?.listStyleType as string | null) ??
      (ordered ? "decimal" : "disc")
    const start = ordered ? Math.max(Number(node.attrs?.start) || 1, 0) : 1
    const reference = this.numbering(ordered, style, start)
    const level = context.list
      ? Math.min(context.list.level + 1, MAX_LIST_LEVEL)
      : 0
    // A nested list in the same style continues its parent's numbering instance.
    const instance =
      context.list?.reference === reference
        ? context.list.instance
        : ++this.instances

    const out: Block[] = []
    for (const item of node.content ?? []) {
      let numbered = false
      for (const child of item.content ?? []) {
        if (child.type === "bulletList" || child.type === "orderedList") {
          out.push(
            ...this.block(child, {
              ...context,
              list: { reference, instance, level },
            })
          )
          continue
        }
        // The item's first block carries the marker; later ones line up with its text.
        const converted = numbered
          ? this.block(child, {
              ...context,
              list: null,
              indent: context.indent + listIndent(level),
            })
          : this.block(child, {
              ...context,
              list: { reference, instance, level },
            })
        out.push(...converted)
        numbered = true
      }
    }
    // The list as a whole keeps a paragraph's space after it.
    if (level === 0) {
      const last = out.at(-1)
      if (last && !(last instanceof Table))
        last.spacing = { ...last.spacing, after: PARAGRAPH_AFTER }
    }
    return out
  }

  private numbering(ordered: boolean, style: string, start: number): string {
    const reference = ordered ? `ordered-${style}-${start}` : `bullet-${style}`
    if (this.lists.has(reference)) return reference
    const levels: ILevelsOptions[] = Array.from(
      { length: MAX_LIST_LEVEL + 1 },
      (_, level) => ({
        level,
        format: ordered
          ? (NUMBER_FORMATS[style] ?? LevelFormat.DECIMAL)
          : LevelFormat.BULLET,
        text: ordered ? `%${level + 1}.` : (BULLETS[style] ?? BULLETS.disc),
        start,
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: { left: listIndent(level), hanging: LIST_INDENT },
          },
        },
      })
    )
    this.lists.set(reference, levels)
    return reference
  }

  private codeBlock(
    node: JSONContent,
    context: BlockContext
  ): ParagraphOptions {
    const text = (node.content ?? []).map((child) => child.text ?? "").join("")
    const run: RunOptions = { font: MONO_FONT, size: 20, color: "111827" }
    return {
      ...this.layout(node, { ...context, list: null }),
      shading: { type: ShadingType.CLEAR, color: "auto", fill: CODE_SHADING },
      indent: {
        left: context.indent + 12 * TWIPS_PER_PX,
        right: 12 * TWIPS_PER_PX,
      },
      spacing: {
        after: PARAGRAPH_AFTER,
        line: 240,
        lineRule: LineRuleType.AUTO,
      },
      children: text
        .split("\n")
        .map((line, index) => textRun(line, run, index > 0)),
    }
  }

  private image(node: JSONContent, context: BlockContext): ImageRun | null {
    const src = node.attrs?.src as string | undefined
    const entry = src ? this.images.get(src) : null
    if (!entry) return null
    const ratio = entry.height / entry.width
    const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : undefined
    // An explicit width (from pasted HTML) wins; otherwise the natural size, shrunk to fit like max-width: 100%.
    const requested = parseFloat(String(node.attrs?.width ?? ""))
    const width = Math.min(
      Number.isFinite(requested) && requested > 0 ? requested : entry.width,
      context.maxWidthPx
    )
    return new ImageRun({
      type: entry.type,
      data: entry.data,
      transformation: {
        width: Math.round(width),
        height: Math.round(width * ratio),
      },
      altText: alt ? { name: alt, description: alt, title: alt } : undefined,
    })
  }

  private table(node: JSONContent, context: BlockContext): Table {
    const rows = node.content ?? []
    const widths = columnWidths(rows, context.maxWidthPx)
    const border = {
      style: BorderStyle.SINGLE,
      size: 6,
      color: TABLE_BORDER_COLOR,
    }

    // Rowspans push later cells to the right, so track which columns are taken.
    const taken: number[] = []
    const tableRows = rows.map((row) => {
      let column = 0
      const cells = (row.content ?? []).map((cell) => {
        while ((taken[column] ?? 0) > 0) column++
        const colspan = Math.max(Number(cell.attrs?.colspan) || 1, 1)
        const rowspan = Math.max(Number(cell.attrs?.rowspan) || 1, 1)
        const widthPx = widths
          .slice(column, column + colspan)
          .reduce((sum, w) => sum + w, 0)
        for (let i = 0; i < colspan; i++) taken[column + i] = rowspan
        column += colspan

        const header = cell.type === "tableHeader"
        const content = this.blocks(cell.content, {
          indent: 0,
          quote: false,
          bold: header,
          list: null,
          maxWidthPx: Math.max(widthPx - 16, 16),
        })
        trimLastSpacing(content)
        return new TableCell({
          children: materialize(content),
          columnSpan: colspan > 1 ? colspan : undefined,
          rowSpan: rowspan > 1 ? rowspan : undefined,
          width: {
            size: Math.round(widthPx * TWIPS_PER_PX),
            type: WidthType.DXA,
          },
          shading: header
            ? { type: ShadingType.CLEAR, color: "auto", fill: CODE_SHADING }
            : undefined,
          margins: {
            top: 4 * TWIPS_PER_PX,
            bottom: 4 * TWIPS_PER_PX,
            left: 8 * TWIPS_PER_PX,
            right: 8 * TWIPS_PER_PX,
          },
        })
      })
      for (let i = 0; i < taken.length; i++) if (taken[i]! > 0) taken[i]!--
      return new TableRow({ children: cells })
    })

    const columnTwips = widths.map((w) => Math.round(w * TWIPS_PER_PX))
    return new Table({
      rows: tableRows,
      layout: TableLayoutType.FIXED,
      columnWidths: columnTwips,
      width: {
        size: columnTwips.reduce((sum, w) => sum + w, 0),
        type: WidthType.DXA,
      },
      indent:
        context.indent > 0
          ? { size: context.indent, type: WidthType.DXA }
          : undefined,
      borders: {
        top: border,
        bottom: border,
        left: border,
        right: border,
        insideHorizontal: border,
        insideVertical: border,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Inline content

  private inline(
    nodes: JSONContent[] | undefined,
    context: BlockContext
  ): ParagraphChild[] {
    const children: ParagraphChild[] = []
    for (const node of nodes ?? []) {
      if (node.type === "hardBreak") {
        children.push(new TextRun({ break: 1 }))
      } else if (node.type === "image") {
        const run = this.image(node, context)
        if (run) children.push(run)
      } else if (node.type === "text" && node.text) {
        const options = runOptions(node.marks, context)
        const run = textRun(node.text, options, false)
        const href = linkHref(node.marks)
        children.push(
          href ? new ExternalHyperlink({ link: href, children: [run] }) : run
        )
      }
    }
    return children
  }
}

// ---------------------------------------------------------------------------
// Helpers

function materialize(blocks: Block[]): (Paragraph | Table)[] {
  const children = blocks.map((block) =>
    block instanceof Table ? block : new Paragraph(block)
  )
  // Word wants every story (body, header, footer, cell) to end with a paragraph.
  if (children.length === 0 || children.at(-1) instanceof Table)
    children.push(new Paragraph({}))
  return children
}

function trimLastSpacing(blocks: Block[]) {
  const last = blocks.at(-1)
  if (last && !(last instanceof Table))
    last.spacing = { ...last.spacing, after: 0 }
}

function listIndent(level: number): number {
  return LIST_INDENT * (level + 1)
}

/** Splits text on tabs and line feeds so Word gets real tab and break elements. */
function textRun(
  text: string,
  options: RunOptions,
  breakBefore: boolean
): TextRun {
  const children: (string | Tab)[] = []
  text.split("\t").forEach((part, index) => {
    if (index > 0) children.push(new Tab())
    if (part) children.push(part)
  })
  const run = { ...options, children, break: breakBefore ? 1 : undefined }
  return new TextRun(run)
}

function runOptions(
  marks: JSONContent["marks"],
  context: BlockContext
): RunOptions {
  const options: RunOptions = {}
  let fontSize: number | undefined
  let code = false
  for (const mark of marks ?? []) {
    const attrs = mark.attrs ?? {}
    switch (mark.type) {
      case "bold":
        options.bold = true
        break
      case "italic":
        options.italics = true
        break
      case "underline":
        options.underline = { type: UnderlineType.SINGLE }
        break
      case "strike":
        options.strike = true
        break
      case "subscript":
        options.subScript = true
        break
      case "superscript":
        options.superScript = true
        break
      case "code":
        code = true
        break
      case "highlight": {
        const fill =
          toHex(attrs.color as string | undefined) ?? DEFAULT_HIGHLIGHT
        options.shading = { type: ShadingType.CLEAR, color: "auto", fill }
        break
      }
      case "textStyle": {
        const color = toHex(attrs.color as string | undefined)
        if (color) options.color = color
        const font = fontName(attrs.fontFamily as string | undefined)
        if (font) options.font = font
        fontSize = halfPoints(attrs.fontSize as string | undefined) ?? fontSize
        const background = toHex(attrs.backgroundColor as string | undefined)
        if (background && !options.shading) {
          options.shading = {
            type: ShadingType.CLEAR,
            color: "auto",
            fill: background,
          }
        }
        break
      }
      case "link":
        if (linkHref([mark])) {
          options.color = options.color ?? LINK_COLOR
          options.underline = { type: UnderlineType.SINGLE }
        }
        break
    }
  }
  if (code) {
    // Inline code: monospace at 0.92em on a light grey ground.
    options.font = MONO_FONT
    options.size = Math.round((fontSize ?? BODY_SIZE) * 0.92)
    options.shading = options.shading ?? {
      type: ShadingType.CLEAR,
      color: "auto",
      fill: CODE_SHADING,
    }
  } else if (fontSize) {
    options.size = fontSize
  }
  if (context.quote && !options.color) options.color = QUOTE_COLOR
  // Header cells are bold in the editor (th { font-weight: 600 }).
  if (context.bold) options.bold = true
  return options
}

function linkHref(marks: JSONContent["marks"]): string | null {
  const href = marks?.find((mark) => mark.type === "link")?.attrs?.href as
    | string
    | undefined
  return href && /^(https?:|mailto:|tel:)/i.test(href.trim())
    ? href.trim()
    : null
}

/** "1.5" or "150%" scale the line; "18pt" / "24px" fix it. */
function lineSpacing(
  value: string | undefined
): ParagraphOptions["spacing"] | null {
  if (!value) return null
  const trimmed = value.trim()
  const match = /^(\d+(?:\.\d+)?)(%|pt|px)?$/.exec(trimmed)
  if (!match) return null
  const amount = Number(match[1])
  switch (match[2]) {
    case "%":
      return { line: Math.round(2.4 * amount), lineRule: LineRuleType.AUTO }
    case "pt":
      return {
        line: Math.round(amount * TWIPS_PER_PT),
        lineRule: LineRuleType.EXACT,
      }
    case "px":
      return {
        line: Math.round(amount * TWIPS_PER_PX),
        lineRule: LineRuleType.EXACT,
      }
    default:
      return { line: Math.round(240 * amount), lineRule: LineRuleType.AUTO }
  }
}

/** "11pt", "16px" or "1.2em" as Word half-points. */
function halfPoints(value: string | undefined): number | undefined {
  const match = value
    ? /^(\d+(?:\.\d+)?)(pt|px|em|rem)$/.exec(value.trim())
    : null
  if (!match) return undefined
  const amount = Number(match[1])
  const points =
    match[2] === "pt"
      ? amount
      : match[2] === "px"
        ? amount * 0.75
        : amount * (BODY_SIZE / 2)
  return Math.min(Math.max(Math.round(points * 2), 2), 800)
}

/** First family of a CSS font stack, with generic families mapped to Word fonts. */
function fontName(stack: string | undefined): string | undefined {
  const first = stack
    ?.split(",")[0]
    ?.trim()
    .replace(/^["']|["']$/g, "")
  if (!first) return undefined
  return GENERIC_FONTS[first.toLowerCase()] ?? first
}

/** CSS colour (hex, rgb()/rgba() or a basic name) as Word's RRGGBB; null when not convertible or transparent. */
function toHex(value: string | undefined | null): string | null {
  if (!value) return null
  const color = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(color)
  if (hex) {
    let digits = hex[1]!
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("")
    if (digits.length === 8 && digits.slice(6) === "00") return null
    return digits.slice(0, 6).toUpperCase()
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(color)
  if (rgb) {
    const parts = rgb[1]!.split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const alpha = parts[3]
    if (alpha !== undefined && parseFloat(alpha) === 0) return null
    const channels = parts.slice(0, 3).map((part) => {
      const n = part.endsWith("%")
        ? (parseFloat(part) / 100) * 255
        : parseFloat(part)
      return Math.min(Math.max(Math.round(n), 0), 255)
    })
    if (channels.some((n) => Number.isNaN(n))) return null
    return channels
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  }
  return NAMED_COLORS[color] ?? null
}

/** Column widths in CSS pixels: resized columns keep their width, the others share what is left. */
function columnWidths(rows: JSONContent[], available: number): number[] {
  const first = rows[0]?.content ?? []
  const widths: (number | null)[] = []
  for (const cell of first) {
    const colspan = Math.max(Number(cell.attrs?.colspan) || 1, 1)
    const colwidth = Array.isArray(cell.attrs?.colwidth)
      ? (cell.attrs.colwidth as unknown[])
      : []
    for (let i = 0; i < colspan; i++) {
      const width = Number(colwidth[i])
      widths.push(Number.isFinite(width) && width > 0 ? width : null)
    }
  }
  if (widths.length === 0) return [available]

  const fixed = widths.reduce<number>((sum, w) => sum + (w ?? 0), 0)
  const free = widths.filter((w) => w === null).length
  // With every column sized the table is as wide as its columns (but never wider than the page).
  if (free === 0) {
    const scale = fixed > available ? available / fixed : 1
    return widths.map((w) => w! * scale)
  }
  const share = Math.max((available - fixed) / free, 30)
  const resolved = widths.map((w) => w ?? share)
  const total = resolved.reduce((sum, w) => sum + w, 0)
  const scale = total > available ? available / total : 1
  return resolved.map((w) => w * scale)
}

// ---------------------------------------------------------------------------
// Images

const WORD_IMAGE_TYPES: Record<string, ImageEntry["type"]> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
}

/** Decodes every image the documents use, keyed by src; unreachable ones map to null and are left out. */
async function loadImages(
  docs: (JSONContent | null)[]
): Promise<Map<string, ImageEntry | null>> {
  const sources = new Set<string>()
  const walk = (node: JSONContent) => {
    if (node.type === "image" && typeof node.attrs?.src === "string")
      sources.add(node.attrs.src)
    node.content?.forEach(walk)
  }
  for (const doc of docs) if (doc) walk(doc)
  const entries = await Promise.all(
    [...sources].map(async (src) => [src, await loadImage(src)] as const)
  )
  return new Map(entries)
}

async function loadImage(src: string): Promise<ImageEntry | null> {
  try {
    // fetch reads data: URIs too; other origins need CORS, and fail quietly without it.
    const response = await fetch(src)
    if (!response.ok) return null
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const width = image.naturalWidth || 300
      const height = image.naturalHeight || 150
      const type = WORD_IMAGE_TYPES[blob.type]
      if (type)
        return {
          data: new Uint8Array(await blob.arrayBuffer()),
          type,
          width,
          height,
        }

      // WebP, SVG, AVIF…: Word cannot embed them, so redraw as PNG.
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height)
      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      )
      return png
        ? {
            data: new Uint8Array(await png.arrayBuffer()),
            type: "png",
            width,
            height,
          }
        : null
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return null
  }
}
