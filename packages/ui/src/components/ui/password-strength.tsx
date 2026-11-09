import { cn } from "@workspace/ui/lib/utils"

/**
 * Four-segment strength meter to sit under a `PasswordInput`.
 *
 * The score is a heuristic, not a policy — whatever schema guards the form is
 * the only thing that can block a submit. This exists to nudge, so the worst it
 * ever says is "weak", and it never blocks anything.
 */

const LEVELS = [
  { label: "Weak", className: "bg-destructive" },
  { label: "Fair", className: "bg-warning" },
  { label: "Good", className: "bg-brand" },
  { label: "Strong", className: "bg-success" },
] as const

/** 1–4, or 0 for an empty field. */
function scorePassword(password: string, minLength: number): number {
  if (!password) {
    return 0
  }

  let points = 0

  if (password.length >= minLength) points += 1
  if (password.length >= minLength + 4) points += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1
  if (/\d/.test(password)) points += 1
  if (/[^\w\s]/.test(password)) points += 1

  // Five possible points folded into four bands: nobody needs to distinguish
  // "good" from "very nearly good".
  return Math.min(4, Math.max(1, points))
}

function PasswordStrength({
  password,
  minLength = 8,
  className,
}: {
  password: string
  /** The form's own minimum, so the first bar lines up with what's enforced. */
  minLength?: number
  className?: string
}) {
  const score = scorePassword(password, minLength)
  const level = score > 0 ? LEVELS[score - 1] : undefined

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex flex-1 gap-1.5" aria-hidden>
        {LEVELS.map((_, index) => (
          <span
            key={index}
            className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn(
                "block h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none",
                index < score ? "scale-x-100" : "scale-x-0",
                level?.className
              )}
            />
          </span>
        ))}
      </div>

      {/* The bars are decorative; this is the accessible version of them. */}
      <p
        aria-live="polite"
        className="w-14 shrink-0 text-right text-2xs text-muted-foreground"
      >
        {level?.label}
        <span className="sr-only">{level ? " password" : ""}</span>
      </p>
    </div>
  )
}

export { PasswordStrength, scorePassword }
