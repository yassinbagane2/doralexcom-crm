"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { Loader2, Trash } from "@workspace/ui/icons"
import { useState } from "react"

import {
  useAddPasskey,
  useDeletePasskey,
  usePasskeys,
} from "@/hooks/queries/passkey"
import { formatDate } from "@/lib/format"

export function Passkeys() {
  const { data: passkeys, isPending } = usePasskeys()
  const deletePasskey = useDeletePasskey()

  return (
    <div className="flex flex-col gap-4">
      {isPending ? (
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      ) : passkeys?.length ? (
        <ul className="divide-y rounded-lg border">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {passkey.name || "Passkey"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Added {formatDate(passkey.createdAt)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${passkey.name || "passkey"}`}
                disabled={deletePasskey.isPending}
                onClick={() => deletePasskey.mutate(passkey.id)}
              >
                <Trash size={16} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No passkeys yet. Add one to sign in with your fingerprint, face or
          device PIN.
        </p>
      )}

      <AddPasskeyDialog />
    </div>
  )
}

function AddPasskeyDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const addPasskey = useAddPasskey()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setName("")
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" className="self-start" />}
      >
        Add passkey
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader className="mb-5">
          <DialogTitle>Add a passkey</DialogTitle>
          <DialogDescription>
            Name it after the device or password manager that holds it, then
            follow your browser&apos;s prompt.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            addPasskey.mutate(name.trim(), { onSuccess: () => setOpen(false) })
          }}
        >
          <Field>
            <Label htmlFor="passkey-name">Name (optional)</Label>
            <Input
              id="passkey-name"
              placeholder="MacBook Touch ID"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={addPasskey.isPending}>
              {addPasskey.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Continue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
