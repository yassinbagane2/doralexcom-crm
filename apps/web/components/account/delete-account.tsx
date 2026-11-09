"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog"

import { PasswordConfirmForm } from "@/components/account/password-confirm-form"
import { useDeleteAccount } from "@/hooks/queries/user"

export function DeleteAccount() {
  const deleteAccount = useDeleteAccount()

  return (
    <Dialog onOpenChange={(open) => !open && deleteAccount.reset()}>
      <DialogTrigger render={<Button variant="destructive" />}>
        Delete account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-5">
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            Your profile, passkeys and sessions are removed immediately. This
            can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <PasswordConfirmForm
          submitLabel="Delete account"
          destructive
          isPending={deleteAccount.isPending}
          error={deleteAccount.error}
          onSubmit={(password) => deleteAccount.mutate(password)}
        />
      </DialogContent>
    </Dialog>
  )
}
