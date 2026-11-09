"use client"

import { useEffect, type ReactNode } from "react"

import {
  AnimatedToastStack,
  useAnimatedToastStack,
  type AnimatedToastAction,
  type AnimatedToastStackProps,
  type ToastInput,
  type ToastStatus,
} from "@workspace/ui/components/motion/animated-toast-stack"

/*
 * App-wide toasts on top of beui's animated toast stack
 * (beui.dev/components/motion/animated-toast-stack).
 *
 * The stack keeps its toasts in component state; this module gives it a
 * global `toast` API so hooks, mutation callbacks and plain functions can
 * raise one without prop drilling. Calls made before <Toaster /> mounts are
 * queued and replayed once it does.
 */

type Command =
  | { kind: "show"; input: ToastInput & { id: string } }
  | { kind: "update"; id: string; patch: Partial<ToastInput> }
  | { kind: "dismiss"; id?: string }

let dispatch: ((command: Command) => void) | null = null
const queue: Command[] = []
let seed = 0

function send(command: Command) {
  if (dispatch) dispatch(command)
  else queue.push(command)
}

export interface ToastOptions {
  id?: string
  description?: ReactNode
  action?: AnimatedToastAction
  /** Milliseconds; 0 keeps the toast until dismissed. */
  duration?: number
  dismissible?: boolean
}

function show(status: ToastStatus, title: ReactNode, options?: ToastOptions) {
  const id = options?.id ?? `toast-${++seed}`
  send({ kind: "show", input: { ...options, id, status, title } })
  return id
}

export const toast = Object.assign(
  (title: ReactNode, options?: ToastOptions) => show("neutral", title, options),
  {
    success: (title: ReactNode, options?: ToastOptions) =>
      show("success", title, options),
    error: (title: ReactNode, options?: ToastOptions) =>
      show("error", title, options),
    info: (title: ReactNode, options?: ToastOptions) =>
      show("info", title, options),
    /** Stays open until updated or dismissed. */
    loading: (title: ReactNode, options?: ToastOptions) =>
      show("loading", title, { duration: 0, ...options }),
    /** Morphs a toast in place, e.g. loading → success. */
    update: (id: string, patch: Partial<ToastInput>) =>
      send({ kind: "update", id, patch }),
    /** Without an id, clears every toast. */
    dismiss: (id?: string) => send({ kind: "dismiss", id }),
  }
)

export type ToasterProps = Omit<
  AnimatedToastStackProps,
  "toasts" | "onDismiss"
> & {
  defaultDuration?: number
  limit?: number
}

/** Mount once, near the root. Renders the stack fixed to a viewport corner. */
export function Toaster({
  defaultDuration = 4200,
  limit = 5,
  position = "bottom-right",
  ...props
}: ToasterProps) {
  const { toasts, showToast, updateToast, dismissToast, clearToasts } =
    useAnimatedToastStack({ defaultDuration, limit })

  useEffect(() => {
    const handle = (command: Command) => {
      if (command.kind === "show") {
        // Re-using an id replaces that toast instead of stacking a copy.
        dismissToast(command.input.id)
        showToast(command.input)
      } else if (command.kind === "update") {
        updateToast(command.id, command.patch)
      } else if (command.id) {
        dismissToast(command.id)
      } else {
        clearToasts()
      }
    }

    dispatch = handle
    queue.splice(0).forEach(handle)

    return () => {
      if (dispatch === handle) dispatch = null
    }
  }, [clearToasts, dismissToast, showToast, updateToast])

  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      position={position}
      fixed
      {...props}
    />
  )
}
