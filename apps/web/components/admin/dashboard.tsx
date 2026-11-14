import { cn } from "@workspace/ui/lib/utils"
import type { ComponentType } from "react"

/*
 * Building blocks of the admin dashboard: rounded panels beside the sidebar,
 * a master-detail split for lists, and the stat cards on overview pages.
 */

/** One full-width panel with an optional title row. */
export function DashboardBody({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-2xl border-border px-4 md:overflow-y-auto md:border md:bg-card md:px-6 md:shadow-xs">
      {title ? (
        <div className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("flex w-full flex-1 flex-col pb-6", className)}>
        {children}
      </div>
    </div>
  )
}

/** A list on the left, the selected item on the right. */
export function MasterDetail({
  list,
  children,
}: {
  list: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 md:flex-row">
      <div className="h-80 w-full shrink-0 overflow-hidden rounded-2xl border bg-card md:h-auto md:max-w-[300px] md:shadow-xs xl:max-w-[340px]">
        {list}
      </div>
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border-border px-4 md:overflow-y-auto md:border md:bg-card md:px-6 md:shadow-xs">
        {children}
      </div>
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}) {
  return (
    <div className="flex min-h-34 flex-col justify-between gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <Icon size={18} className="text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {detail ? (
        <div className="text-xs leading-relaxed wrap-break-word text-muted-foreground">
          {detail}
        </div>
      ) : null}
    </div>
  )
}

export function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-base font-medium">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

/** A tinted pill naming where an account stands. */
export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "danger" | "warning" | "neutral"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap",
        {
          success:
            "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
          danger:
            "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
          warning:
            "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
          neutral: "bg-muted text-foreground",
        }[tone]
      )}
    >
      {children}
    </span>
  )
}
