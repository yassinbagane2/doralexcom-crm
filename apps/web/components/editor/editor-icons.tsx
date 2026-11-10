import type { ComponentProps, ReactNode } from "react"

// Icons for the drafting editor chrome. The shared icon library has no
// word-processor glyphs (alignment, lists, sub/superscript…), so these live
// here, all drawn on the same 24px grid with the same stroke so they read as
// one set.

export type EditorIconProps = Omit<ComponentProps<"svg">, "children"> & {
  size?: number
}

function Icon({
  size = 18,
  className,
  children,
  ...props
}: EditorIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export const UndoIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
  </Icon>
)

export const RedoIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
  </Icon>
)

export const PageSetupIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4" />
    <path d="M14 2v6h6" />
    <path d="M20 8v3" />
    <circle cx="16" cy="17" r="2.5" />
    <path d="M16 12.5V14" />
    <path d="M16 20v1.5" />
    <path d="M11.5 17H13" />
    <path d="M19 17h1.5" />
    <path d="m12.8 13.8 1.1 1.1" />
    <path d="m18.1 19.1 1.1 1.1" />
    <path d="m19.2 13.8-1.1 1.1" />
    <path d="m13.9 19.1-1.1 1.1" />
  </Icon>
)

export const PenIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </Icon>
)

export const BoldIcon = (p: EditorIconProps) => (
  <Icon {...p} strokeWidth={2.25}>
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
  </Icon>
)

export const ItalicIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="19" x2="10" y1="4" y2="4" />
    <line x1="14" x2="5" y1="20" y2="20" />
    <line x1="15" x2="9" y1="4" y2="20" />
  </Icon>
)

export const UnderlineIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
    <line x1="4" x2="20" y1="20" y2="20" />
  </Icon>
)

export const StrikethroughIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M16 4H9a3 3 0 0 0-2.83 4" />
    <path d="M14 12a4 4 0 0 1 0 8H6" />
    <line x1="4" x2="20" y1="12" y2="12" />
  </Icon>
)

export const SubscriptIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m4 5 8 8" />
    <path d="m12 5-8 8" />
    <path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07" />
  </Icon>
)

export const SuperscriptIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m4 19 8-8" />
    <path d="m12 19-8-8" />
    <path d="M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06" />
  </Icon>
)

export const TextColorIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m6 17 6-13 6 13" />
    <path d="M8.5 11.5h7" />
  </Icon>
)

export const HighlighterIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </Icon>
)

export const AlignLeftIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="15" x2="3" y1="12" y2="12" />
    <line x1="17" x2="3" y1="18" y2="18" />
  </Icon>
)

export const AlignCenterIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="17" x2="7" y1="12" y2="12" />
    <line x1="19" x2="5" y1="18" y2="18" />
  </Icon>
)

export const AlignRightIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="21" x2="9" y1="12" y2="12" />
    <line x1="21" x2="7" y1="18" y2="18" />
  </Icon>
)

export const AlignJustifyIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="3" x2="21" y1="6" y2="6" />
    <line x1="3" x2="21" y1="12" y2="12" />
    <line x1="3" x2="21" y1="18" y2="18" />
  </Icon>
)

export const LineSpacingIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M10 6h11" />
    <path d="M10 12h11" />
    <path d="M10 18h11" />
    <path d="M4 5v14" />
    <path d="m2 7.5 2-2.5 2 2.5" />
    <path d="m2 16.5 2 2.5 2-2.5" />
  </Icon>
)

export const BulletListIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="9" x2="21" y1="6" y2="6" />
    <line x1="9" x2="21" y1="12" y2="12" />
    <line x1="9" x2="21" y1="18" y2="18" />
    <circle cx="4" cy="6" r="1" fill="currentColor" />
    <circle cx="4" cy="12" r="1" fill="currentColor" />
    <circle cx="4" cy="18" r="1" fill="currentColor" />
  </Icon>
)

export const OrderedListIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="10" x2="21" y1="6" y2="6" />
    <line x1="10" x2="21" y1="12" y2="12" />
    <line x1="10" x2="21" y1="18" y2="18" />
    <path d="M4 6h1v4" />
    <path d="M4 10h2" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </Icon>
)

export const IndentIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <polyline points="3 8 7 12 3 16" />
    <line x1="21" x2="11" y1="12" y2="12" />
    <line x1="21" x2="11" y1="6" y2="6" />
    <line x1="21" x2="11" y1="18" y2="18" />
  </Icon>
)

export const OutdentIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <polyline points="7 8 3 12 7 16" />
    <line x1="21" x2="11" y1="12" y2="12" />
    <line x1="21" x2="11" y1="6" y2="6" />
    <line x1="21" x2="11" y1="18" y2="18" />
  </Icon>
)

export const PilcrowIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M13 4v16" />
    <path d="M17 4v16" />
    <path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />
  </Icon>
)

export const PaletteIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <circle cx="13.5" cy="6.5" r=".6" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".6" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".6" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".6" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </Icon>
)

export const TableIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </Icon>
)

export const InsertIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <line x1="3" x2="21" y1="6" y2="6" />
    <path d="M3 12h15a3 3 0 1 1 0 6h-4" />
    <polyline points="16 16 14 18 16 20" />
    <line x1="3" x2="10" y1="18" y2="18" />
  </Icon>
)

export const TextStylesIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M4 7V4h12v3" />
    <path d="M10 4v12" />
    <path d="M7 16h6" />
    <path d="m21 11-6 6-2.5.5.5-2.5 6-6a1.4 1.4 0 0 1 2 2Z" />
  </Icon>
)

export const SpellCheckIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m5 16 5.5-11 5.5 11" />
    <path d="M7.1 12h6.8" />
    <path d="m14 19 2 2 4.5-4.5" />
  </Icon>
)

export const ImageIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </Icon>
)

export const LinkIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
)

export const PencilIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </Icon>
)

export const SuggestIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="m9.5 12.5 1.5 1.5 4-4" />
  </Icon>
)

export const EyeIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const EyeOffIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Icon>
)

export const FilePlusIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M12 18v-6" />
    <path d="M9 15h6" />
  </Icon>
)

export const DocumentIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
    <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" />
    <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />
  </Icon>
)

export const SaveIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
    <path d="M7 3v4a1 1 0 0 0 1 1h7" />
  </Icon>
)

export const SyncIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    <circle cx="17" cy="5" r="1" fill="currentColor" />
  </Icon>
)

export const CloudCheckIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M17.5 19a4.5 4.5 0 1 0-.7-8.95A7 7 0 1 0 6.5 19Z" />
    <path d="m9 13 2 2 4-4" />
  </Icon>
)

export const ChatBubbleIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5h-6.3L7 19.8V16H6.5A2.5 2.5 0 0 1 4 13.5Z" />
    <path d="m9.5 11 2.5-3 2.5 3" />
    <path d="M9.5 13h5" />
  </Icon>
)

export const WandIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
    <path d="m14 7 3 3" />
    <path d="M5 6v4" />
    <path d="M19 14v4" />
    <path d="M10 2v2" />
    <path d="M7 8H3" />
    <path d="M21 16h-4" />
    <path d="M11 3H9" />
  </Icon>
)

export const MicIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </Icon>
)

export const BookIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </Icon>
)

export const PlusIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Icon>
)

export const MinusIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
)

export const ArrowUpIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </Icon>
)

export const MoreIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </Icon>
)

export const CloseIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
)

export const ChevronDownIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const CheckIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)

export const QuoteIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
    <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
  </Icon>
)

export const CodeIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </Icon>
)

export const HorizontalRuleIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M4 12h16" />
    <path d="M6 5h12" strokeOpacity={0.35} />
    <path d="M6 19h12" strokeOpacity={0.35} />
  </Icon>
)

export const TrashIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </Icon>
)

export const UploadIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </Icon>
)

export const FileTextIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </Icon>
)

export const CommentIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </Icon>
)

export const SuggestionMarkerIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-3 3-3-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M8 10.5h.01" />
    <path d="M12 10.5h.01" />
    <path d="M16 10.5h.01" />
  </Icon>
)

export const SparklesIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
    <path d="M19 17v4" />
    <path d="M17 19h4" />
    <path d="M5 3v3" />
    <path d="M3.5 4.5h3" />
  </Icon>
)

export const StarIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  </Icon>
)

export const CopyIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Icon>
)

export const PrinterIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </Icon>
)

export const DownloadIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </Icon>
)

export const ChevronLeftIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)

export const ChevronRightIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)

export const GearIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const SearchIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

export const FilePenIcon = (p: EditorIconProps) => (
  <Icon {...p}>
    <path d="M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" />
    <path d="M8 7h6" />
    <path d="M8 11h6" />
    <path d="M8 15h2" />
    <path d="M19.4 13.6a1.4 1.4 0 0 1 2 2L16.9 20l-2.6.7.7-2.6z" />
  </Icon>
)
