"use client"

import { UserAvatar } from "@/components/user-avatar"

/** Who is signed in. */
export function AccountOverview({
  name,
  email,
}: {
  name: string
  email: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-5">
      <UserAvatar name={name} className="size-15 text-lg" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-[17px] leading-tight font-medium tracking-[-0.2px]">
          {name}
        </span>
        <span className="truncate text-sm text-muted-foreground">{email}</span>
      </div>
    </div>
  )
}
