"use client"

import { zodResolver } from "@hookform/resolvers/zod"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import {
  DotsHorizontal,
  Info,
  Loader2,
  SendIcon,
  Trash,
  UserPlus,
} from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { UserAvatar } from "@/components/user-avatar"
import {
  useCollaborators,
  useInviteCollaborator,
  useRemoveCollaborator,
  useResendInvitation,
} from "@/hooks/queries/settings"
import { formatRelative } from "@/lib/format"

type Collaborator = NonNullable<
  ReturnType<typeof useCollaborators>["data"]
>[number]

/**
 * Who works on the business: its owner and the collaborators they invited.
 * Everyone in the business sees the list; only the owner changes it.
 */
export function Collaborators({
  isOwner,
  currentUserId,
}: {
  isOwner: boolean
  currentUserId: string
}) {
  const t = useTranslations("Collaborators")
  const { data: people, isPending } = useCollaborators()
  const hasCollaborators = people?.some((p) => p.role === "collaborator")

  return (
    <div className="flex flex-col gap-4">
      {isOwner ? (
        <InviteDialog />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          {t("ownerOnly")}
        </p>
      )}

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {people?.map((person) => (
            <CollaboratorRow
              key={person.id}
              person={person}
              isYou={person.id === currentUserId}
              canManage={isOwner && person.role === "collaborator"}
            />
          ))}
        </ul>
      )}

      {!isPending && !hasCollaborators ? (
        <div className="flex flex-col gap-0.5 text-sm">
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="text-muted-foreground">{t("emptyDescription")}</p>
        </div>
      ) : null}
    </div>
  )
}

function CollaboratorRow({
  person,
  isYou,
  canManage,
}: {
  person: Collaborator
  isYou: boolean
  canManage: boolean
}) {
  const t = useTranslations("Collaborators")
  const locale = useLocale()
  const [removing, setRemoving] = useState(false)
  const resend = useResendInvitation()

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <UserAvatar name={person.name} className="size-9" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{person.name}</span>
          {person.role === "owner" ? (
            <Badge variant="secondary">{t("owner")}</Badge>
          ) : null}
          {isYou ? <Badge variant="outline">{t("you")}</Badge> : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {person.email}
        </span>
      </div>
      <span className="hidden text-xs text-muted-foreground sm:block">
        {person.lastActiveAt
          ? t("lastActive", {
              time: formatRelative(person.lastActiveAt, locale) ?? t("justNow"),
            })
          : t("notSignedIn")}
      </span>

      {canManage ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("actions", { name: person.name })}
                />
              }
            >
              <DotsHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={resend.isPending}
                onClick={() => resend.mutate({ userId: person.id })}
              >
                <SendIcon size={16} />
                {t("resend")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setRemoving(true)}
              >
                <Trash size={16} />
                {t("remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <RemoveDialog
            person={person}
            open={removing}
            onOpenChange={setRemoving}
          />
        </>
      ) : null}
    </li>
  )
}

function useInviteSchema() {
  const t = useTranslations("Validation")

  return useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(100, t("nameTooLong")),
        email: z.email(t("emailInvalid")),
      }),
    [t]
  )
}

function InviteDialog() {
  const t = useTranslations("Collaborators")
  const [open, setOpen] = useState(false)
  const invite = useInviteCollaborator()
  const schema = useInviteSchema()

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" },
  })
  const { errors } = form.formState

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          invite.reset()
          form.reset()
        }
      }}
    >
      <DialogTrigger render={<Button className="self-start" />}>
        <UserPlus size={16} />
        {t("invite")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-5">
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteDescription")}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit((values) =>
            invite.mutate(values, {
              onSuccess: () => {
                setOpen(false)
                form.reset()
              },
            })
          )}
        >
          <Field>
            <Label htmlFor="collaborator-name">{t("nameLabel")}</Label>
            <Input
              id="collaborator-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              aria-describedby="collaborator-name-error"
              {...form.register("name")}
            />
            <FieldError id="collaborator-name-error">
              {errors.name?.message}
            </FieldError>
          </Field>
          <Field>
            <Label htmlFor="collaborator-email">{t("emailLabel")}</Label>
            <Input
              id="collaborator-email"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
              aria-describedby="collaborator-email-error"
              {...form.register("email")}
            />
            <FieldError id="collaborator-email-error">
              {errors.email?.message}
            </FieldError>
          </Field>
          <Button
            type="submit"
            disabled={invite.isPending}
            className="self-end"
          >
            {invite.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("inviteSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveDialog({
  person,
  open,
  onOpenChange,
}: {
  person: Collaborator
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Collaborators")
  const tCommon = useTranslations("Common")
  const remove = useRemoveCollaborator()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle", { name: person.name })}</DialogTitle>
          <DialogDescription>{t("removeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(
                { userId: person.id },
                { onSuccess: () => onOpenChange(false) }
              )
            }
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
