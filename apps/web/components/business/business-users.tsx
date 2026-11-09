"use client"

import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog"
import { Loader2, Plus, Trash, Users } from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { UserAvatar } from "@/components/user-avatar"
import { CreateAccountForm } from "@/components/users/create-account-form"
import {
  useBusinessUsers,
  useCreateBusinessUser,
  useRemoveBusinessUser,
} from "@/hooks/queries/business"
import { formatDate, formatRelative } from "@/lib/format"

/** A business's users: everyone it created inside its organization. */
export function BusinessUsers() {
  const t = useTranslations("BusinessUsers")
  const { data: users, isPending } = useBusinessUsers()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <CreateUserDialog />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : users && users.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

type BusinessUser = NonNullable<
  ReturnType<typeof useBusinessUsers>["data"]
>[number]

function UserRow({ user }: { user: BusinessUser }) {
  const t = useTranslations("BusinessUsers")
  const locale = useLocale()
  const lastActive = user.lastActiveAt
    ? formatRelative(user.lastActiveAt, locale)
    : null

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <UserAvatar name={user.name} className="size-9" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{user.name}</span>
          {user.banned ? (
            <Badge variant="destructive">{t("suspended")}</Badge>
          ) : null}
          {!user.emailVerified ? (
            <Badge variant="outline">{t("unverified")}</Badge>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {user.email}
        </span>
      </div>
      <div className="hidden flex-col items-end text-xs text-muted-foreground sm:flex">
        <span>{t("added", { date: formatDate(user.createdAt, locale) })}</span>
        <span>
          {user.lastActiveAt
            ? t("lastActive", { time: lastActive ?? t("justNow") })
            : t("neverSignedIn")}
        </span>
      </div>
      <RemoveUserDialog user={user} />
    </li>
  )
}

function CreateUserDialog() {
  const t = useTranslations("BusinessUsers")
  const [open, setOpen] = useState(false)
  const createUser = useCreateBusinessUser()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) createUser.reset()
      }}
    >
      <DialogTrigger render={<Button className="self-start sm:self-auto" />}>
        <Plus size={16} />
        {t("add")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-5">
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <CreateAccountForm
          submitLabel={t("createSubmit")}
          isPending={createUser.isPending}
          onSubmit={(values) =>
            createUser.mutate(values, { onSuccess: () => setOpen(false) })
          }
        />
      </DialogContent>
    </Dialog>
  )
}

function RemoveUserDialog({ user }: { user: BusinessUser }) {
  const t = useTranslations("BusinessUsers")
  const tCommon = useTranslations("Common")
  const [open, setOpen] = useState(false)
  const removeUser = useRemoveBusinessUser()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("removeLabel", { name: user.name })}
          />
        }
      >
        <Trash size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle", { name: user.name })}</DialogTitle>
          <DialogDescription>{t("removeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={removeUser.isPending}
            onClick={() =>
              removeUser.mutate(
                { userId: user.id },
                { onSuccess: () => setOpen(false) }
              )
            }
          >
            {removeUser.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("removeSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
