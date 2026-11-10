"use client"

import type { Editor } from "@tiptap/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import {
  DOCUMENT_THEMES,
  LINE_SPACINGS,
  TEXT_STYLES,
  type TextStyleOption,
} from "./document-options"
import {
  LineSpacingIcon,
  PageSetupIcon,
  PaletteIcon,
  TextStylesIcon,
} from "./editor-icons"
import {
  formatCm,
  PAGE_MARGIN_IDS,
  PAGE_MARGINS,
  PAGE_SIZE_IDS,
  PAGE_SIZES,
  type PageMarginId,
  type PageOrientation,
  type PageSizeId,
} from "./page-geometry"
import {
  keepEditorFocus,
  ToolbarButton,
  ToolbarMenuButton,
} from "./toolbar-primitives"
import type { DraftDocument } from "./use-draft-document"

const MENU_LABEL = "text-muted-foreground text-xs"
/** Radio value standing for side margins dragged on the ruler; it is shown, never picked. */
const CUSTOM_MARGINS = "custom"

export function PageSetupMenu({
  draft,
  disabled,
}: {
  draft: DraftDocument
  disabled: boolean
}) {
  const t = useTranslations("Editor")
  const { pageSetup, updatePageSetup } = draft
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton label={t("pageSetup.label")}>
            <PageSetupIcon />
          </ToolbarMenuButton>
        }
      />
      <DropdownMenuContent
        align="start"
        finalFocus={keepEditorFocus}
        className="w-56 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL}>
            {t("pageSetup.paperSize")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={pageSetup.size}
            onValueChange={(size) =>
              updatePageSetup({ size: size as PageSizeId })
            }
          >
            {PAGE_SIZE_IDS.map((id) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {PAGE_SIZES[id].label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL}>
            {t("pageSetup.orientation")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={pageSetup.orientation}
            onValueChange={(orientation) =>
              updatePageSetup({ orientation: orientation as PageOrientation })
            }
          >
            <DropdownMenuRadioItem value="portrait">
              {t("pageSetup.portrait")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="landscape">
              {t("pageSetup.landscape")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL}>
            {t("pageSetup.margins")}
          </DropdownMenuLabel>
          {/* A preset applies to every side, replacing a side margin dragged on the ruler. */}
          <DropdownMenuRadioGroup
            value={
              pageSetup.sideMargin !== null ? CUSTOM_MARGINS : pageSetup.margin
            }
            onValueChange={(margin) =>
              updatePageSetup({
                margin: margin as PageMarginId,
                sideMargin: null,
              })
            }
          >
            {pageSetup.sideMargin !== null && (
              <DropdownMenuRadioItem
                value={CUSTOM_MARGINS}
                disabled
                className="justify-between"
              >
                {t("pageSetup.customSides")}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {formatCm(pageSetup.sideMargin)} cm
                </span>
              </DropdownMenuRadioItem>
            )}
            {PAGE_MARGIN_IDS.map((id) => (
              <DropdownMenuRadioItem
                key={id}
                value={id}
                className="justify-between"
              >
                {t(`margins.${id}`)}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {PAGE_MARGINS[id].cm} cm
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ */
/* Document theme                                                      */
/* ------------------------------------------------------------------ */

export function ThemeMenu({
  draft,
  disabled,
}: {
  draft: DraftDocument
  disabled: boolean
}) {
  const t = useTranslations("Editor")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton
            label={t(`themes.${draft.theme.id}.label`)}
            showLabel
            pill
            className="w-40 justify-between"
          >
            <PaletteIcon />
          </ToolbarMenuButton>
        }
      />
      <DropdownMenuContent
        align="start"
        finalFocus={keepEditorFocus}
        className="w-64 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL}>
            {t("toolbar.documentTheme")}
          </DropdownMenuLabel>
          <ThemeItems draft={draft} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Theme radio items, shared by the theme menu and the folded "Styles" menu. */
function ThemeItems({ draft }: { draft: DraftDocument }) {
  const t = useTranslations("Editor.themes")
  return (
    <DropdownMenuRadioGroup
      value={draft.theme.id}
      onValueChange={(id) => {
        const theme = DOCUMENT_THEMES.find((candidate) => candidate.id === id)
        if (theme) draft.changeTheme(theme)
      }}
    >
      {DOCUMENT_THEMES.map((theme) => (
        <DropdownMenuRadioItem
          key={theme.id}
          value={theme.id}
          className="items-start rounded-lg py-2"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0 rounded-full"
            style={{ backgroundColor: theme.accent }}
          />
          <span className="flex flex-col">
            <span
              className="font-medium"
              style={{ fontFamily: theme.headingFont }}
            >
              {t(`${theme.id}.label`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(`${theme.id}.description`)}
            </span>
          </span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

/* ------------------------------------------------------------------ */
/* Paragraph style                                                     */
/* ------------------------------------------------------------------ */

function applyTextStyle(editor: Editor, id: string) {
  const style = TEXT_STYLES.find((candidate) => candidate.id === id)
  if (!style) return
  if (style.level === null) editor.chain().focus().setParagraph().run()
  else editor.chain().focus().setHeading({ level: style.level }).run()
}

const STYLE_PREVIEW: Record<number, string> = {
  1: "text-xl",
  2: "text-lg font-semibold",
  3: "text-base font-semibold",
  4: "text-sm font-semibold",
}

/** Paragraph style radio items; `preview` renders each label in its own size. */
function TextStyleItems({
  editor,
  value,
  preview = false,
}: {
  editor: Editor
  value: TextStyleOption
  preview?: boolean
}) {
  const t = useTranslations("Editor.textStyles")
  return (
    <DropdownMenuRadioGroup
      value={value.id}
      onValueChange={(id) => applyTextStyle(editor, id)}
    >
      {TEXT_STYLES.map((style) => (
        <DropdownMenuRadioItem
          key={style.id}
          value={style.id}
          className={cn(
            preview && style.level !== null && STYLE_PREVIEW[style.level]
          )}
        >
          {t(style.id)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

export function TextStyleMenu({
  editor,
  value,
  disabled,
}: {
  editor: Editor
  value: TextStyleOption
  disabled: boolean
}) {
  const t = useTranslations("Editor.textStyles")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton
            label={t(value.id)}
            showLabel
            pill
            className="w-40 justify-between"
          />
        }
      />
      <DropdownMenuContent
        align="start"
        finalFocus={keepEditorFocus}
        className="w-56 rounded-xl p-1.5"
      >
        <TextStyleItems editor={editor} value={value} preview />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Narrow-toolbar menu that folds the paragraph style and theme pickers together. */
export function StylesMenu({
  editor,
  draft,
  value,
  disabled,
}: {
  editor: Editor
  draft: DraftDocument
  value: TextStyleOption
  disabled: boolean
}) {
  const t = useTranslations("Editor.toolbar")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton label={t("styles")}>
            <TextStylesIcon />
          </ToolbarMenuButton>
        }
      />
      <DropdownMenuContent
        align="start"
        finalFocus={keepEditorFocus}
        className="w-60 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL}>
            {t("paragraphStyle")}
          </DropdownMenuLabel>
          <TextStyleItems editor={editor} value={value} />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PaletteIcon />
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 rounded-xl p-1.5">
            <ThemeItems draft={draft} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ */
/* Line spacing                                                        */
/* ------------------------------------------------------------------ */

export function LineSpacingMenu({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations("Editor.toolbar")
  const spacingLabel = (spacing: string) =>
    spacing === "1" ? t("single") : spacing === "2" ? t("double") : spacing
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <ToolbarMenuButton label={t("lineSpacing")} pill className="ml-1">
            <LineSpacingIcon />
            <span className="font-semibold tabular-nums">{value}</span>
          </ToolbarMenuButton>
        }
      />
      <DropdownMenuContent
        align="start"
        finalFocus={keepEditorFocus}
        className="w-40 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL}>
            {t("lineSpacing")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onChange(String(next))}
          >
            {LINE_SPACINGS.map((spacing) => (
              <DropdownMenuRadioItem
                key={spacing}
                value={spacing}
                className="tabular-nums"
              >
                {spacingLabel(spacing)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

/** List toggle with a chevron that opens the bullet / numbering styles. */
export function SplitListButton({
  label,
  styleLabel,
  shortcut,
  icon,
  active,
  disabled,
  onToggle,
  styles,
  currentStyle,
  onStyle,
}: {
  label: string
  styleLabel: string
  shortcut: string
  icon: ReactNode
  active: boolean
  disabled: boolean
  onToggle: () => void
  styles: readonly { id: string; label: string }[]
  currentStyle: string
  onStyle: (style: string) => void
}) {
  return (
    <div className="flex items-center">
      <ToolbarButton
        label={label}
        shortcut={shortcut}
        active={active}
        disabled={disabled}
        onClick={onToggle}
        className="rounded-r-none"
      >
        {icon}
      </ToolbarButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <ToolbarMenuButton
              label={styleLabel}
              active={active}
              className="w-5 rounded-l-none px-0"
            />
          }
        />
        <DropdownMenuContent
          align="start"
          finalFocus={keepEditorFocus}
          className="w-40 rounded-xl p-1.5"
        >
          <DropdownMenuRadioGroup
            value={currentStyle}
            onValueChange={(style) => onStyle(String(style))}
          >
            {styles.map((style) => (
              <DropdownMenuRadioItem key={style.id} value={style.id}>
                {style.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
