import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Label / control / message grouping for any form field.
 *
 * Composed rather than a single `<Field label error .../>` component, because
 * the header is not always just a label — a password field wants "Forgot?"
 * opposite it, and a link nested inside a `<label>` steals the click that
 * should have focused the input.
 *
 *   <Field>
 *     <FieldHeader>
 *       <Label htmlFor="password">Password</Label>
 *       <Link href="/reset-password">Forgot?</Link>
 *     </FieldHeader>
 *     <Input id="password" aria-describedby="password-error" />
 *     <FieldError id="password-error">{errors.password}</FieldError>
 *   </Field>
 */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

/** Row above the control, for a label plus anything sitting opposite it. */
function FieldHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-header"
      className={cn("flex items-baseline justify-between gap-3", className)}
      {...props}
    />
  )
}

/**
 * Validation message. Renders nothing without children, so call sites can pass
 * a possibly-undefined error straight through instead of guarding each one.
 */
function FieldError({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  if (!children) {
    return null
  }

  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn(
        "animate-in text-xs text-destructive duration-200 fade-in-0 slide-in-from-top-1",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

/** Hint or helper text under a control. Same slot, quieter voice. */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Field, FieldDescription, FieldError, FieldHeader }
