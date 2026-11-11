import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

/** A titled block on the customer page: a quiet heading over its content. */
export function Section({
  title,
  count,
  action,
  children,
  className,
}: {
  title: ReactNode
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <header className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-medium">
          <span className="truncate">{title}</span>
          {count ? (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/** What a section shows while it has nothing in it. */
export function SectionEmpty({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl bg-muted/40 px-6 py-10 text-center",
        className
      )}
    >
      <span className="mb-3 grid size-10 place-items-center rounded-xl bg-background text-muted-foreground shadow-xs [&_svg]:size-4">
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
