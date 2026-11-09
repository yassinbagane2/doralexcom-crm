"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@workspace/ui/lib/utils"

function RadioGroup<Value>({
  className,
  ...props
}: RadioGroupPrimitive.Props<Value>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioCard<Value>({
  className,
  ...props
}: RadioPrimitive.Root.Props<Value>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-card"
      className={cn(
        "group flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-input bg-transparent p-3 text-left shadow-xs transition-[color,border-color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5 data-disabled:pointer-events-none data-disabled:opacity-50 dark:bg-input/30 dark:data-checked:bg-primary/10",
        className
      )}
      {...props}
    />
  )
}

export { RadioCard, RadioGroup }
