"use client"

import { Button } from "@workspace/ui/components/ui/button"

import { useSignOut } from "@/hooks/queries/auth"

export function SignOutButton({ label }: { label: string }) {
  const signOut = useSignOut()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate()}
    >
      {label}
    </Button>
  )
}
