"use client"

import * as React from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react"

import { cn } from "@workspace/ui/lib/utils"

const EASE_OUT = [0.16, 1, 0.3, 1] as const

export type OTPStatus = "idle" | "error" | "success"

export interface OTPInputProps {
  length?: number
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  label?: string
  hint?: string
  successMessage?: string
  errorMessage?: string
  status?: OTPStatus
  mask?: boolean
  disabled?: boolean
  autoFocus?: boolean
  "aria-label"?: string
  className?: string
}

function OTPInput({
  length = 6,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onComplete,
  label,
  hint,
  successMessage,
  errorMessage,
  status = "idle",
  mask = false,
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel = "One-time passcode",
  className,
}: OTPInputProps) {
  const uid = React.useId()
  const reduce = useReducedMotion()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const slotsRef = React.useRef<HTMLDivElement>(null)

  const controlled = controlledValue !== undefined

  const [slots, setSlots] = React.useState<string[]>(() =>
    toSlots(controlled ? controlledValue : defaultValue, length)
  )
  const [focused, setFocused] = React.useState(false)
  const [active, setActive] = React.useState(0)

  const joined = slots.join("")
  const joinedRef = React.useRef(joined)

  React.useEffect(() => {
    joinedRef.current = joined
  }, [joined])

  React.useEffect(() => {
    if (!controlled) return
    const incoming = sanitize(controlledValue, length)
    if (incoming !== joinedRef.current) setSlots(toSlots(incoming, length))
  }, [controlled, controlledValue, length])

  const commit = (next: string[]) => {
    const wasComplete = slots.every((char) => char !== "")
    setSlots(next)
    const value = next.join("")
    onChange?.(value)
    if (!wasComplete && next.every((char) => char !== "")) onComplete?.(value)
  }

  const clearSlot = (index: number) => {
    const next = [...slots]
    next[index] = ""
    commit(next)
  }

  const slotFromClientX = (clientX: number) => {
    const els = slotsRef.current?.children
    if (!els) return 0
    for (let i = 0; i < els.length; i++) {
      if (clientX < els[i]!.getBoundingClientRect().right) return i
    }
    return length - 1
  }

  const insert = (raw: string, from = active) => {
    const digits = raw.replace(/\D/g, "")
    if (!digits) return
    const next = [...slots]
    let i = from
    for (const char of digits) {
      if (i >= length) break
      next[i] = char
      i++
    }
    commit(next)
    setActive(Math.min(i, length - 1))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key

    if (/^[0-9]$/.test(key)) {
      event.preventDefault()
      insert(key)
      return
    }

    if (key === "Backspace") {
      event.preventDefault()
      if (slots[active]) {
        clearSlot(active)
      } else if (active > 0) {
        clearSlot(active - 1)
        setActive((current) => Math.max(current - 1, 0))
      }
      return
    }

    if (key === "Delete") {
      event.preventDefault()
      clearSlot(active)
      return
    }

    if (key === "ArrowLeft") {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
      return
    }

    if (key === "ArrowRight") {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, length - 1))
      return
    }

    if (key === "Home") {
      event.preventDefault()
      setActive(0)
      return
    }

    if (key === "End") {
      event.preventDefault()
      setActive(length - 1)
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return
    event.preventDefault()
    insert(event.clipboardData.getData("text"), active)
  }

  const handleAutofill = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitize(event.target.value, length)
    if (!digits) return
    commit(toSlots(digits, length))
    setActive(Math.min(digits.length, length - 1))
  }

  React.useEffect(() => {
    if (!autoFocus || disabled) return
    inputRef.current?.focus()
  }, [autoFocus, disabled])

  React.useEffect(() => {
    if (status !== "error" || reduce || !slotsRef.current) return
    animate(
      slotsRef.current,
      { x: [0, -5, 5, -3, 3, -1, 0] },
      { duration: 0.45, ease: EASE_OUT }
    )
  }, [status, reduce])

  const showSuccess = status === "success"
  const showError = status === "error"
  const activeIndex = disabled ? -1 : active
  const typing = focused && !disabled
  const message = showSuccess ? successMessage : showError ? errorMessage : hint

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <label
          htmlFor={`${uid}-input`}
          className="text-sm leading-none font-medium text-foreground"
        >
          {label}
        </label>
      ) : null}

      <fieldset
        className="relative m-0 inline-flex w-max border-0 p-0"
        onMouseDown={(event) => {
          if (disabled) return
          event.preventDefault()
          const firstEmpty = slots.indexOf("")
          const cap = firstEmpty === -1 ? length - 1 : firstEmpty
          setActive(Math.min(slotFromClientX(event.clientX), cap))
          inputRef.current?.focus()
        }}
      >
        <input
          ref={inputRef}
          id={`${uid}-input`}
          inputMode="numeric"
          autoComplete="one-time-code"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={showError}
          value=""
          maxLength={length}
          onKeyDown={handleKeyDown}
          onChange={handleAutofill}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 z-20 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
        />

        <div ref={slotsRef} className="flex items-center gap-2">
          {Array.from({ length }, (_, index) => {
            const char = slots[index] ?? ""
            const isActive = index === activeIndex

            return (
              <div
                key={`${uid}-${index}`}
                data-slot="otp-slot"
                data-active={isActive}
                data-filled={char !== ""}
                className={cn(
                  "relative grid h-13 w-11 place-items-center overflow-hidden rounded-lg border border-input bg-transparent text-lg font-semibold tabular-nums shadow-xs transition-[color,background-color,border-color,box-shadow] sm:w-12",
                  char ? "text-foreground" : "text-muted-foreground",
                  showSuccess && "border-success",
                  showError && "border-destructive ring-3 ring-destructive/20",
                  isActive &&
                    !showSuccess &&
                    !showError &&
                    (typing
                      ? "border-ring bg-brand-subtle/60 ring-3 ring-ring/50"
                      : "border-ring/60"),
                  disabled && "pointer-events-none opacity-50"
                )}
              >
                {isActive && typing && !showSuccess ? (
                  <motion.span
                    aria-hidden
                    animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
                    transition={
                      reduce
                        ? undefined
                        : {
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                          }
                    }
                    className={cn(
                      "pointer-events-none absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-brand",
                      char ? "right-2" : "left-1/2 -translate-x-1/2"
                    )}
                  />
                ) : null}

                <AnimatePresence initial={false}>
                  {char ? (
                    <motion.span
                      key={char}
                      initial={
                        reduce
                          ? { opacity: 0 }
                          : { y: 14, opacity: 0, filter: "blur(4px)" }
                      }
                      animate={
                        reduce
                          ? { opacity: 1 }
                          : { y: 0, opacity: 1, filter: "blur(0px)" }
                      }
                      exit={
                        reduce
                          ? { opacity: 0 }
                          : { y: -14, opacity: 0, filter: "blur(4px)" }
                      }
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.22, ease: EASE_OUT }
                      }
                      className="absolute inset-0 grid place-items-center leading-none"
                    >
                      {mask ? "•" : char}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </fieldset>

      {message ? (
        <p
          aria-live="polite"
          className={cn(
            "text-sm",
            showSuccess
              ? "text-success"
              : showError
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}

function sanitize(raw: string, length: number) {
  return raw.replace(/\D/g, "").slice(0, length)
}

function toSlots(raw: string, length: number) {
  const digits = sanitize(raw, length)
  return Array.from({ length }, (_, index) => digits[index] ?? "")
}

export { OTPInput }
