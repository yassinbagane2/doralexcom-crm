export function AuthHeader({
  title,
  description,
}: {
  title: string
  description?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
        {title}
      </h1>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}
