// Barrel for the icon library, consumed as `@workspace/ui/icons`.
//
// Two kinds of icons live here:
//
//  1. Hand-authored (mostly motion-animated) icons, one file per icon,
//     with two animation APIs:
//       - `isHovered`-pattern icons (ArrowRight, Calendar, Mail, Settings…)
//         loop forever by default — pass `isHovered` so they only animate on
//         hover.
//       - forwardRef icons (Home, Users, Logout…) are static until hovered and
//         expose start/stopAnimation via `AnimatedIconHandle`.
//  2. Lucide re-exports for glyphs the app needs but nobody has hand-authored
//     yet. Promoting one is a one-line change here — call sites keep their
//     import.
//
// App code should import icons from here, never from `lucide-react` directly.

// --- Hand-authored icons -----------------------------------------------------
export { default as AdjustmentsHorizontalIcon } from "@workspace/ui/icons/adjustments-icon"
export { default as ShieldCheck } from "@workspace/ui/icons/shield-check"
export { default as ArrowLeftIcon } from "@workspace/ui/icons/arrow-left"
export { default as ArrowRight } from "@workspace/ui/icons/arrow-right"
export { default as Settings } from "@workspace/ui/icons/settings"
export { default as Logout } from "@workspace/ui/icons/logout"
export { default as Crown } from "@workspace/ui/icons/crown"
export { default as DotsHorizontal } from "@workspace/ui/icons/dots-horizontal"
export { default as Lock } from "@workspace/ui/icons/lock"
export { UserPlus } from "@workspace/ui/icons/user-plus"
export { UserCircle } from "@workspace/ui/icons/user-circle"
export { Stack } from "@workspace/ui/icons/stack"
export { Plus } from "@workspace/ui/icons/plus"
export { Home } from "@workspace/ui/icons/home"
export { MagnifyingGlass } from "@workspace/ui/icons/magnifying-glass"
export { User } from "@workspace/ui/icons/user"
export { Users } from "@workspace/ui/icons/users"
export { Briefcase } from "@workspace/ui/icons/briefcase"
export { Trash } from "@workspace/ui/icons/trash"
export { Pen } from "@workspace/ui/icons/pen"
export { Eye } from "@workspace/ui/icons/eye"
export { Loader } from "@workspace/ui/icons/loader"
export { Clock } from "@workspace/ui/icons/clock"
export { Tag } from "@workspace/ui/icons/tag"
export { XIcon } from "@workspace/ui/icons/XIcon"
export { Calendar } from "@workspace/ui/icons/calendar"
export { BuildingOffice } from "@workspace/ui/icons/building-office"
export { FolderOpen } from "@workspace/ui/icons/folder-open"
export { FolderPlus } from "@workspace/ui/icons/folder-plus"
export { FolderUp } from "@workspace/ui/icons/folder-up"
export { FolderInput } from "@workspace/ui/icons/folder-input"
export { FolderArchive } from "@workspace/ui/icons/folder-archive"
export { WordDocument } from "@workspace/ui/icons/word-document"
export { PdfDocument } from "@workspace/ui/icons/pdf-document"
export { Download } from "@workspace/ui/icons/download"
export { ArrowTurnLeft } from "@workspace/ui/icons/arrow-turn-left"
export { Upload } from "@workspace/ui/icons/upload"
export { Chrome } from "@workspace/ui/icons/chrome"
export { Firefox } from "@workspace/ui/icons/firefox"
export { Mail } from "@workspace/ui/icons/mail"
export { Activity } from "@workspace/ui/icons/activity"
export { Leaf } from "@workspace/ui/icons/leaf"
export { Alphabets } from "@workspace/ui/icons/alphabets"
export { LayoutDashboard } from "@workspace/ui/icons/layout-dashboard"
export { TrendingUp } from "@workspace/ui/icons/trending-up"
export { SendIcon } from "@workspace/ui/icons/send-icon"
export { HistoryIcon } from "@workspace/ui/icons/history-icon"
export { Fingerprint } from "@workspace/ui/icons/fingerprint"
export { HandRaised } from "@workspace/ui/icons/raised-hand"
export { Workflow } from "@workspace/ui/icons/workflows"
export { LanguageIcon } from "@workspace/ui/icons/language"

// --- Lucide re-exports -------------------------------------------------------
// `ActivityIcon` is lucide's alias for its Activity — the plain name is taken
// by the hand-authored one above. Same idea for `X` (XIcon) and `Loader2`
// (Loader).
export {
  ActivityIcon,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Banknote,
  Ban,
  Bell,
  BellOff,
  Boxes,
  Building,
  Building2,
  BriefcaseMedical,
  Calculator,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Check,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsUpDown,
  Compass,
  Contact,
  Copy,
  CreditCard,
  DoorOpen,
  ExternalLink,
  EyeOff,
  Feather,
  Flower2,
  Glasses,
  Hand,
  HandCoins,
  Heart,
  Info,
  KeyRound,
  Landmark,
  LifeBuoy,
  Loader2,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Moon,
  PanelLeftIcon,
  PawPrint,
  Pencil,
  Phone,
  Receipt,
  RefreshCw,
  Ruler,
  Scale,
  Scissors,
  SearchIcon,
  Shapes,
  Sparkles,
  SquareParking,
  Star,
  StickyNote,
  Stethoscope,
  Store,
  Sun,
  UserX,
  Wallet,
  Warehouse,
  X,
} from "lucide-react"

export type { LucideIcon } from "lucide-react"

export type {
  IconProps,
  AnimatedIconProps,
  AnimatedIconHandle,
} from "@workspace/ui/icons/types"
