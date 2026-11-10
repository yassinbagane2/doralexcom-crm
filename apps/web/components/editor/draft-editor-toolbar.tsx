"use client"

import { useRef, type ChangeEvent, type ReactNode } from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { TooltipProvider } from "@workspace/ui/components/ui/tooltip"
import { toast } from "@workspace/ui/components/motion/toaster"
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  CodeIcon,
  HighlighterIcon,
  HorizontalRuleIcon,
  ImageIcon,
  IndentIcon,
  InsertIcon,
  ItalicIcon,
  OrderedListIcon,
  OutdentIcon,
  PenIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  RedoIcon,
  SpellCheckIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TextColorIcon,
  UnderlineIcon,
  UndoIcon,
  type EditorIconProps,
} from "./editor-icons"
import {
  keepEditorFocus,
  ToolbarButton,
  ToolbarGroup,
  ToolbarMenuButton,
  ToolbarSeparator,
} from "./toolbar-primitives"
import { ColorPicker } from "./toolbar-color-picker"
import { FontFamilyMenu, FontSizeControl } from "./toolbar-font-controls"
import { LinkControl } from "./toolbar-link-control"
import { FieldMenu } from "./toolbar-field-menu"
import {
  LineSpacingMenu,
  PageSetupMenu,
  SplitListButton,
  StylesMenu,
  TextStyleMenu,
  ThemeMenu,
} from "./toolbar-menus"
import { TablePicker } from "./toolbar-table-picker"
import {
  BULLET_STYLES,
  DEFAULT_HIGHLIGHT,
  DEFAULT_LINE_SPACING,
  HIGHLIGHT_COLORS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  NUMBER_STYLES,
  TEXT_COLORS,
  TEXT_STYLES,
  findFontByValue,
  parseFontSize,
} from "./document-options"
import type { DraftDocument } from "./use-draft-document"

/** `id` also names the button in the "Editor.toolbar" messages. */
type ToolbarItem<Id extends string> = {
  id: Id
  shortcut: string
  icon: (props: EditorIconProps) => ReactNode
}

const ALIGNMENTS = [
  { id: "left", shortcut: "⌘⇧L", icon: AlignLeftIcon },
  { id: "center", shortcut: "⌘⇧E", icon: AlignCenterIcon },
  { id: "right", shortcut: "⌘⇧R", icon: AlignRightIcon },
  { id: "justify", shortcut: "⌘⇧J", icon: AlignJustifyIcon },
] as const satisfies readonly ToolbarItem<string>[]

type MarkName =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "subscript"
  | "superscript"

/** Character formatting, toggled with `toggleMark(id)`. */
const TEXT_MARKS: readonly ToolbarItem<MarkName>[] = [
  { id: "bold", shortcut: "⌘B", icon: BoldIcon },
  { id: "italic", shortcut: "⌘I", icon: ItalicIcon },
  { id: "underline", shortcut: "⌘U", icon: UnderlineIcon },
  { id: "strike", shortcut: "⌘⇧S", icon: StrikethroughIcon },
]
const SCRIPT_MARKS: readonly ToolbarItem<MarkName>[] = [
  { id: "subscript", shortcut: "⌘,", icon: SubscriptIcon },
  { id: "superscript", shortcut: "⌘.", icon: SuperscriptIcon },
]
const MARK_NAMES = [...TEXT_MARKS, ...SCRIPT_MARKS].map((mark) => mark.id)

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Toolbars are wide enough for every control above this container width;
// below it the rarely used groups fold into "Styles" and "Insert" menus. The
// table picker stays visible at every width: it also holds the row, column and
// delete actions for the table under the caret.
const WIDE = "hidden @7xl:flex"
const NARROW = "flex @7xl:hidden"

function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => {
      const textStyle = editor.getAttributes("textStyle")
      const isHeading = editor.isActive("heading")
      const block = editor.getAttributes(isHeading ? "heading" : "paragraph")
      return {
        editable: editor.isEditable,
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        marks: Object.fromEntries(
          MARK_NAMES.map((name) => [name, editor.isActive(name)])
        ) as Record<MarkName, boolean>,
        bulletList: editor.isActive("bulletList"),
        orderedList: editor.isActive("orderedList"),
        blockquote: editor.isActive("blockquote"),
        codeBlock: editor.isActive("codeBlock"),
        inTable: editor.isActive("table"),
        link: (editor.getAttributes("link").href as string | undefined) ?? null,
        // Blocks without an explicit alignment follow the page, which is left-aligned.
        align:
          ALIGNMENTS.find((a) => editor.isActive({ textAlign: a.id }))?.id ??
          "left",
        fontFamily: textStyle.fontFamily as string | undefined,
        fontSize: parseFontSize(textStyle.fontSize as string | undefined),
        color: textStyle.color as string | undefined,
        highlight: editor.getAttributes("highlight").color as
          | string
          | undefined,
        lineHeight: (block.lineHeight as string | null) ?? DEFAULT_LINE_SPACING,
        headingLevel: isHeading ? (block.level as number) : null,
        bulletStyle:
          (editor.getAttributes("bulletList").listStyleType as string | null) ??
          "disc",
        numberStyle:
          (editor.getAttributes("orderedList").listStyleType as
            | string
            | null) ?? "decimal",
      }
    },
  })
}

type ToolbarProps = {
  editor: Editor
  draft: DraftDocument
  /** Offers the merge fields a contract template fills in. */
  fields?: boolean
}

export function DraftEditorToolbar({
  editor,
  draft,
  fields = false,
}: ToolbarProps) {
  const t = useTranslations("Editor")
  const state = useToolbarState(editor)
  const locked = !state.editable
  const imageInputRef = useRef<HTMLInputElement>(null)

  const chain = () => editor.chain().focus()

  const currentTextStyle =
    TEXT_STYLES.find((style) => style.level === state.headingLevel) ??
    TEXT_STYLES[0]!
  // Text without its own font or size has its style's, from the theme.
  const styleFont = currentTextStyle.level
    ? draft.theme.headingFont
    : draft.theme.bodyFont
  const fontFamily = state.fontFamily ?? styleFont
  const fontLabel =
    findFontByValue(fontFamily)?.label ??
    fontFamily.split(",")[0]!.replace(/["']/g, "").trim()
  const fontSize = state.fontSize ?? currentTextStyle.size

  const setFontSize = (size: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size))
    chain().setFontSize(`${clamped}pt`).run()
  }

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(t("toolbar.imageOnly"))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("toolbar.imageTooLarge"))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        chain().setImage({ src: reader.result, alt: file.name }).run()
      }
    }
    reader.onerror = () => toast.error(t("toolbar.imageUnreadable"))
    reader.readAsDataURL(file)
  }

  const markButtons = (marks: readonly ToolbarItem<MarkName>[]) =>
    marks.map((mark) => (
      <ToolbarButton
        key={mark.id}
        label={t(`toolbar.${mark.id}`)}
        shortcut={mark.shortcut}
        active={state.marks[mark.id]}
        disabled={locked}
        onClick={() => chain().toggleMark(mark.id).run()}
      >
        <mark.icon />
      </ToolbarButton>
    ))

  const insertItems = (
    <>
      <DropdownMenuItem onClick={() => chain().setHorizontalRule().run()}>
        <HorizontalRuleIcon />
        {t("toolbar.horizontalRule")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => chain().toggleBlockquote().run()}>
        <QuoteIcon />
        {state.blockquote ? t("toolbar.removeQuote") : t("toolbar.quote")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => chain().toggleCodeBlock().run()}>
        <CodeIcon />
        {state.codeBlock
          ? t("toolbar.removeCodeBlock")
          : t("toolbar.codeBlock")}
      </DropdownMenuItem>
    </>
  )

  return (
    <TooltipProvider delay={350}>
      <div className="@container flex shrink-0 items-stretch border-b border-border">
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2">
          {/* Row 1: history, page, font, lists, structure */}
          <div className="flex [scrollbar-width:none] items-center gap-0.5 overflow-x-auto">
            <ToolbarGroup>
              <ToolbarButton
                label={t("toolbar.undo")}
                shortcut="⌘Z"
                disabled={locked || !state.canUndo}
                onClick={() => chain().undo().run()}
              >
                <UndoIcon />
              </ToolbarButton>
              <ToolbarButton
                label={t("toolbar.redo")}
                shortcut="⌘⇧Z"
                disabled={locked || !state.canRedo}
                onClick={() => chain().redo().run()}
              >
                <RedoIcon />
              </ToolbarButton>
            </ToolbarGroup>
            <ToolbarSeparator />

            <PageSetupMenu draft={draft} disabled={locked} />
            <ToolbarSeparator />

            <FontFamilyMenu
              label={fontLabel}
              value={fontFamily}
              styleValue={styleFont}
              disabled={locked}
              onSelect={(value) =>
                value
                  ? chain().setFontFamily(value).run()
                  : chain().unsetFontFamily().run()
              }
            />
            <FontSizeControl
              value={fontSize}
              disabled={locked}
              onChange={setFontSize}
            />
            <ToolbarSeparator />

            <ToolbarGroup>
              <SplitListButton
                label={t("toolbar.bulletList")}
                styleLabel={t("toolbar.bulletStyle")}
                shortcut="⌘⇧8"
                icon={<BulletListIcon />}
                active={state.bulletList}
                disabled={locked}
                onToggle={() => chain().toggleBulletList().run()}
                styles={BULLET_STYLES.map((id) => ({
                  id,
                  label: t(`bulletStyles.${id}`),
                }))}
                currentStyle={state.bulletStyle}
                onStyle={(style) => chain().setBulletStyle(style).run()}
              />
              <SplitListButton
                label={t("toolbar.numberedList")}
                styleLabel={t("toolbar.numberStyle")}
                shortcut="⌘⇧7"
                icon={<OrderedListIcon />}
                active={state.orderedList}
                disabled={locked}
                onToggle={() => chain().toggleOrderedList().run()}
                styles={NUMBER_STYLES}
                currentStyle={state.numberStyle}
                onStyle={(style) => chain().setNumberStyle(style).run()}
              />
            </ToolbarGroup>
            <ToolbarSeparator />

            <ToolbarGroup>
              <ToolbarButton
                label={t("toolbar.increaseIndent")}
                shortcut="Tab"
                disabled={locked}
                onClick={() => chain().indent().run()}
              >
                <IndentIcon />
              </ToolbarButton>
              <ToolbarButton
                label={t("toolbar.decreaseIndent")}
                shortcut="⇧Tab"
                disabled={locked}
                onClick={() => chain().outdent().run()}
              >
                <OutdentIcon />
              </ToolbarButton>
              <ToolbarButton
                label={
                  draft.showMarks
                    ? t("toolbar.hideMarks")
                    : t("toolbar.showMarks")
                }
                active={draft.showMarks}
                onClick={draft.toggleMarks}
              >
                <PilcrowIcon />
              </ToolbarButton>
            </ToolbarGroup>
            <ToolbarSeparator />

            <ToolbarGroup className={WIDE}>
              <ThemeMenu draft={draft} disabled={locked} />
            </ToolbarGroup>
            <ToolbarGroup className={NARROW}>
              <StylesMenu
                editor={editor}
                draft={draft}
                value={currentTextStyle}
                disabled={locked}
              />
            </ToolbarGroup>
            <TablePicker
              editor={editor}
              inTable={state.inTable}
              disabled={locked}
            />
            <ToolbarGroup className={WIDE}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={locked}
                  render={
                    <ToolbarMenuButton label={t("toolbar.insert")}>
                      <InsertIcon />
                    </ToolbarMenuButton>
                  }
                />
                <DropdownMenuContent
                  align="start"
                  finalFocus={keepEditorFocus}
                  className="w-56 rounded-xl p-1.5"
                >
                  {insertItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </ToolbarGroup>
          </div>

          {/* Row 2: character and paragraph formatting */}
          <div className="flex [scrollbar-width:none] items-center gap-0.5 overflow-x-auto">
            <ToolbarButton
              label={locked ? t("toolbar.editingOn") : t("toolbar.editingOff")}
              active={!locked}
              onClick={() => draft.setEditable(locked)}
            >
              <PenIcon />
            </ToolbarButton>
            <ToolbarSeparator />

            <ToolbarGroup>{markButtons(TEXT_MARKS)}</ToolbarGroup>
            <ToolbarGroup className="ml-1">
              {markButtons(SCRIPT_MARKS)}
            </ToolbarGroup>

            <ToolbarGroup className="ml-1">
              <ColorPicker
                label={t("toolbar.textColor")}
                icon={<TextColorIcon />}
                swatches={TEXT_COLORS}
                value={state.color}
                fallback="#000000"
                clearLabel={t("toolbar.defaultColor")}
                disabled={locked}
                onSelect={(color) => chain().setColor(color).run()}
                onClear={() => chain().unsetColor().run()}
              />
              <ColorPicker
                label={t("toolbar.highlightColor")}
                icon={<HighlighterIcon />}
                swatches={HIGHLIGHT_COLORS}
                value={state.highlight}
                fallback={DEFAULT_HIGHLIGHT}
                clearLabel={t("toolbar.noHighlight")}
                columns={4}
                disabled={locked}
                onSelect={(color) => chain().setHighlight({ color }).run()}
                onClear={() => chain().unsetHighlight().run()}
              />
            </ToolbarGroup>
            <ToolbarSeparator />

            <ToolbarGroup>
              {ALIGNMENTS.map((alignment) => (
                <ToolbarButton
                  key={alignment.id}
                  label={t(`toolbar.${alignment.id}`)}
                  shortcut={alignment.shortcut}
                  active={state.align === alignment.id}
                  disabled={locked}
                  onClick={() => chain().setTextAlign(alignment.id).run()}
                >
                  <alignment.icon />
                </ToolbarButton>
              ))}
            </ToolbarGroup>

            <LineSpacingMenu
              value={state.lineHeight}
              disabled={locked}
              onChange={(value) => chain().setLineSpacing(value).run()}
            />
            <ToolbarSeparator />

            <ToolbarGroup className={WIDE}>
              <TextStyleMenu
                editor={editor}
                value={currentTextStyle}
                disabled={locked}
              />
              <ToolbarButton
                label={
                  draft.spellcheck
                    ? t("toolbar.spellcheckOn")
                    : t("toolbar.spellcheckOff")
                }
                active={draft.spellcheck}
                onClick={draft.toggleSpellcheck}
                className="ml-1"
              >
                <SpellCheckIcon />
              </ToolbarButton>
              <ToolbarButton
                label={t("toolbar.insertImage")}
                disabled={locked}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageIcon />
              </ToolbarButton>
            </ToolbarGroup>

            <ToolbarGroup className={NARROW}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={locked}
                  render={
                    <ToolbarMenuButton label={t("toolbar.insert")}>
                      <PlusIcon />
                    </ToolbarMenuButton>
                  }
                />
                <DropdownMenuContent
                  align="start"
                  finalFocus={keepEditorFocus}
                  className="w-56 rounded-xl p-1.5"
                >
                  <DropdownMenuItem
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <ImageIcon />
                    {t("toolbar.image")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {insertItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </ToolbarGroup>

            <LinkControl
              editor={editor}
              current={state.link}
              disabled={locked}
            />
          </div>
        </div>

        {fields ? (
          <div className="flex items-center border-l border-border px-3">
            <FieldMenu editor={editor} disabled={locked} />
          </div>
        ) : null}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickImage}
        />
      </div>
    </TooltipProvider>
  )
}
