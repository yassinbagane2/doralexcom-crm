import { cn } from "@workspace/ui/lib/utils"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

export function UserAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-medium text-brand select-none",
        className
      )}
    >
      {getInitials(name)}
    </span>
  )
}
