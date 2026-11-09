"use client"

import * as React from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"

import { Button } from "@workspace/ui/components/ui/button"
import { EASE_OUT, SPRING_LAYOUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"

export interface StepFormClassNames {
  header?: string
  counter?: string
  progress?: string
  eyebrow?: string
  title?: string
  description?: string
  body?: string
  footer?: string
  back?: string
}

export interface StepFormProps extends Omit<
  React.ComponentProps<"form">,
  "title"
> {
  step: number
  totalSteps: number
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  primaryAction: React.ReactNode
  onBack?: () => void
  backLabel?: React.ReactNode
  backDisabled?: boolean
  counter?: boolean
  progressBar?: boolean
  animationKey?: React.Key
  classNames?: StepFormClassNames
}

const STEP_VARIANTS: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction * 16,
    filter: "blur(4px)",
  }),
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.32, ease: EASE_OUT },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -16,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: EASE_OUT },
  }),
}

export function StepForm({
  step,
  totalSteps,
  eyebrow,
  title,
  description,
  primaryAction,
  onBack,
  backLabel = "Back",
  backDisabled = false,
  counter = true,
  progressBar = true,
  animationKey,
  classNames,
  className,
  children,
  ...props
}: StepFormProps) {
  const reduce = useReducedMotion()
  const [previousStep, setPreviousStep] = React.useState(step)
  const [direction, setDirection] = React.useState(1)

  if (step !== previousStep) {
    setDirection(step > previousStep ? 1 : -1)
    setPreviousStep(step)
  }

  const paddedStep = String(step + 1).padStart(2, "0")
  const paddedTotal = String(totalSteps).padStart(2, "0")
  const progress = totalSteps > 0 ? (step + 1) / totalSteps : 0

  return (
    <form data-slot="step-form" className={cn("w-full", className)} {...props}>
      <div className={cn("flex flex-col gap-4", classNames?.header)}>
        {counter || progressBar ? (
          <div className="flex flex-col gap-2">
            {counter ? (
              <div className="relative h-4 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={step}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    className={cn(
                      "absolute inset-0 text-xs font-medium text-muted-foreground tabular-nums",
                      classNames?.counter
                    )}
                  >
                    {paddedStep} / {paddedTotal}
                  </motion.span>
                </AnimatePresence>
              </div>
            ) : null}
            {progressBar ? (
              <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={totalSteps}
                aria-valuenow={step + 1}
                className={cn(
                  "h-1 overflow-hidden rounded-full bg-border",
                  classNames?.progress
                )}
              >
                <motion.div
                  className="h-full rounded-full bg-primary"
                  style={{ transformOrigin: "left" }}
                  initial={false}
                  animate={{ scaleX: progress }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          {eyebrow ? (
            <p
              className={cn(
                "text-xs font-medium tracking-wide text-primary uppercase",
                classNames?.eyebrow
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "text-2xl font-semibold tracking-[-0.02em] text-balance",
              eyebrow && "mt-1",
              classNames?.title
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-2 text-sm leading-relaxed text-muted-foreground",
                classNames?.description
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <motion.div layout transition={SPRING_LAYOUT} className="mt-4">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={animationKey ?? step}
            custom={direction}
            variants={STEP_VARIANTS}
            initial={reduce ? false : "initial"}
            animate={reduce ? { opacity: 1 } : "animate"}
            exit={reduce ? undefined : "exit"}
            className={cn("flex flex-col gap-3", classNames?.body)}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className={cn("mt-6 flex flex-col gap-3", classNames?.footer)}>
        {primaryAction}
        {step > 0 && onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={backDisabled}
            onClick={onBack}
            className={cn("w-full rounded-full", classNames?.back)}
          >
            {backLabel}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
