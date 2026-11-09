import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const alertVariants = cva(
  "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed [&>svg]:mt-px [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        destructive:
          "border-destructive/25 bg-destructive/8 text-destructive dark:bg-destructive/12",
        success:
          "border-success/25 bg-success/8 text-success dark:bg-success/12",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Message about the block it sits in, rather than about one control —
 * "that email and password don't match", "we couldn't reach the server".
 *
 * `role="alert"` is the default because that is what nearly every use here is:
 * something that appeared in response to an action. Pass `role` explicitly for
 * a banner that is present on first paint, which shouldn't interrupt.
 */
function Alert({
  className,
  variant,
  role = "alert",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={role}
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Alert, alertVariants }
