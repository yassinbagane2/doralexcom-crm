import { cn } from "@workspace/ui/lib/utils"

/**
 * One block of an account page: what it is on the left, the controls on the
 * right. Collapses to a single column on narrow screens.
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "grid gap-x-10 gap-y-5 border-b py-8 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)]",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
