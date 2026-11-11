import { cn } from "@workspace/ui/lib/utils"
import { useId } from "react"

/**
 * Tenora brand mark: a house-shaped badge with a "T" knocked out of it.
 * Brand colors are fixed (blue-500 → blue-700, matching the primary token)
 * so the mark looks the same in light and dark mode.
 */
export function LogoMark({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  // Unique per instance so two marks on one page never share a gradient id.
  const gradientId = useId()

  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="none"
      height={size}
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="5"
          x2="27"
          y1="4"
          y2="28"
        >
          <stop offset="0" stopColor="#2b7fff" />
          <stop offset="1" stopColor="#1447e6" />
        </linearGradient>
      </defs>
      <path
        d="M5 14.2 16 5l11 9.2V26a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 26Z"
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M10.5 15h11M16 15v8.5"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="3.2"
      />
    </svg>
  )
}
