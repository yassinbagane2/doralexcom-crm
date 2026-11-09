"use client"

import * as React from "react"
import { Eye, EyeOff } from "@workspace/ui/icons"

import { Input } from "@workspace/ui/components/ui/input"
import { cn } from "@workspace/ui/lib/utils"

/** Password field with a keyboard-accessible reveal toggle. */
function PasswordInput({
  className,
  inputSize,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [revealed, setRevealed] = React.useState(false)
  const large = inputSize === "lg"

  return (
    <div data-slot="password-input" className="relative">
      <Input
        type={revealed ? "text" : "password"}
        inputSize={inputSize}
        disabled={disabled}
        // Clears the toggle, which is as wide as the field is tall.
        className={cn(large ? "pr-11" : "pr-9", className)}
        {...props}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? "Hide password" : "Show password"}
        aria-pressed={revealed}
        className="absolute inset-y-0 right-0 grid aspect-square place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
