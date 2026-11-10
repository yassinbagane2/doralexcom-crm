import { cn } from "@workspace/ui/lib/utils"

/*
 * Building blocks of the settings pages: a centred column of sections, each a
 * heading over its controls, and soft cards that hold rows of related items.
 */

/** The column a settings page sits in. `wide` makes room for a table. */
export function SettingsPage({
  wide,
  children,
}: {
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-10",
        wide ? "max-w-5xl" : "max-w-2xl"
      )}
    >
      {children}
    </div>
  )
}

/** A heading and description over the controls they describe. */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {title ? (
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-medium tracking-tight">{title}</h2>
            {description ? (
              <p className="text-sm text-pretty text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** A soft, tinted card. Rows inside it are separated by dividers. */
export function SettingsCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-secondary/30",
        className
      )}
    >
      {children}
    </div>
  )
}

/** A card's top line: a short label on the left, an action on the right. */
export function SettingsCardHeader({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <span className="text-sm text-muted-foreground">{children}</span>
      {action}
    </div>
  )
}

/** The rows of a card, separated by dividers. */
export function SettingsCardRows({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul className={cn("divide-y divide-border/60 px-4", className)}>
      {children}
    </ul>
  )
}

/** One item: an icon tile, what it is, then its controls on the right. */
export function SettingsRow({
  icon,
  title,
  description,
  htmlFor,
  children,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Makes the title the label of the control with this id. */
  htmlFor?: string
  children?: React.ReactNode
  className?: string
}) {
  const Title = htmlFor ? "label" : "span"

  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      {icon ? <SettingsIcon>{icon}</SettingsIcon> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Title
          htmlFor={htmlFor}
          className="flex flex-wrap items-center gap-2 text-sm font-medium"
        >
          {title}
        </Title>
        {description ? (
          <span className="text-xs text-pretty text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}

/** The rounded tile an icon sits in at the start of a row. */
export function SettingsIcon({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-4",
        className
      )}
    >
      {children}
    </span>
  )
}
