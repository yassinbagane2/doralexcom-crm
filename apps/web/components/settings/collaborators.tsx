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
import { INVITATION_EXPIRES_IN_DAYS } from "@workspace/auth/organization"
import {
  Crown,
  DotsHorizontal,
  Info,
  Loader2,
  Mail,
  SearchIcon,
  SendIcon,
  Trash,
  UserPlus,
  Users,
  X,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { useDeferredValue, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { SettingsIcon } from "@/components/account/settings-section"
import { UserAvatar } from "@/components/user-avatar"
import {
  type Invitation,
  useCancelInvitation,
  useCollaborators,
  useInvitations,
  useInviteCollaborator,
  useRemoveCollaborator,
  useResendInvitation,
} from "@/hooks/queries/settings"
import { formatDate, formatRelative } from "@/lib/format"

type Collaborator = NonNullable<
  ReturnType<typeof useCollaborators>["data"]
>[number]

const COLUMNS = 5

/**
 * Who works on the business: its owner, the collaborators who joined, and,
 * for the owner, the invitations still out (pending or expired) and those
 * that ended (canceled or declined). Everyone in the business sees the
 * members; only the owner invites or removes anyone.
 */
export function Collaborators({
  isOwner,
  currentUserId,
  organizationId,
  organizationName,
}: {
  isOwner: boolean
  currentUserId: string
  organizationId: string
  organizationName: string
}) {
  const t = useTranslations("Collaborators")
  const { data: people, isPending } = useCollaborators()
  const { data: invitations } = useInvitations(organizationId, isOwner)
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search.trim().toLocaleLowerCase())

  const matches = (values: string[]) =>
    !query || values.some((value) => value.toLocaleLowerCase().includes(query))

  const active = (people ?? []).filter((person) =>
    matches([person.name, person.email])
  )
  const shownInvitations = (invitations ?? []).filter(
    (invitation) =>
      invitation.status !== "accepted" && matches([invitation.email])
  )
  const pending = shownInvitations.filter((i) => i.status === "pending")
  const ended = shownInvitations.filter((i) => i.status !== "pending")
  const hasCollaborators =
    people?.some((p) => p.role === "collaborator") ||
    invitations?.some((i) => i.status === "pending")

  const sections = [
    active.length > 0 ? (
      <GroupHeader
        key="active"
        label={t("groupActive", { count: active.length })}
      />
    ) : null,
    ...active.map((person) => (
      <CollaboratorRow
        key={person.id}
        person={person}
        organizationId={organizationId}
        isYou={person.id === currentUserId}
        canManage={isOwner && person.role === "collaborator"}
      />
    )),
    pending.length > 0 ? (
      <GroupHeader
        key="pending"
        label={t("groupPending", { count: pending.length })}
      />
    ) : null,
    ...pending.map((invitation) => (
      <InvitationRow
        key={invitation.id}
        invitation={invitation}
        organizationId={organizationId}
      />
    )),
    ended.length > 0 ? (
      <GroupHeader
        key="ended"
        label={t("groupCanceled", { count: ended.length })}
      />
    ) : null,
    ...ended.map((invitation) => (
      <InvitationRow
        key={invitation.id}
        invitation={invitation}
        organizationId={organizationId}
      />
    )),
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-2xl border bg-background/90 p-4">
        <UserAvatar
          name={organizationName}
          className="size-14 rounded-lg text-base"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-lg leading-tight font-semibold">
            {organizationName}
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users size={14} className="size-3.5" />
            {isPending ? "…" : t("memberCount", { count: people?.length ?? 0 })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-md border bg-muted/60 px-2.5 sm:w-72">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-9 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        {isOwner ? (
          <InviteDialog organizationId={organizationId} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" />
            {t("ownerOnly")}
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">{t("columns.name")}</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                {t("columns.role")}
              </th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                {t("columns.added")}
              </th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                {t("columns.lastActive")}
              </th>
              <th className="w-12 px-4 py-2.5">
                <span className="sr-only">{t("columns.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              [0, 1].map((i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td colSpan={COLUMNS} className="px-4 py-3">
                    <div className="h-9 animate-pulse rounded-md bg-muted" />
                  </td>
                </tr>
              ))
            ) : sections.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  {t("noResults")}
                </td>
              </tr>
            ) : (
              sections
            )}
          </tbody>
        </table>
      </div>

      {!isPending && !hasCollaborators ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center">
          <SettingsIcon>
            <UserPlus />
          </SettingsIcon>
          <div className="flex flex-col gap-0.5 text-sm">
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-pretty text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <tr className="border-b bg-muted/60">
      <td
        colSpan={COLUMNS}
        className="px-4 py-1.5 text-xs font-medium text-muted-foreground"
      >
        {label}
      </td>
    </tr>
  )
}

function CollaboratorRow({
  person,
  organizationId,
  isYou,
  canManage,
}: {
  person: Collaborator
  organizationId: string
  isYou: boolean
  canManage: boolean
}) {
  const t = useTranslations("Collaborators")
  const locale = useLocale()
  const [removing, setRemoving] = useState(false)

  const lastActive = person.lastActiveAt
    ? t("lastActive", {
        time: formatRelative(person.lastActiveAt, locale) ?? t("justNow"),
      })
    : t("notSignedIn")

  return (
    <tr className="border-b transition-colors last:border-b-0 hover:bg-secondary/40">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={person.name} className="size-9" />
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 font-medium">
              <span className="truncate">{person.name}</span>
              {isYou ? <Badge variant="outline">{t("you")}</Badge> : null}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {person.email}
            </span>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <RoleBadge role={person.role} />
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-foreground/80 md:table-cell">
        {formatDate(person.createdAt, locale)}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
        <span className="flex items-center gap-2 text-foreground/80">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              person.lastActiveAt ? "bg-emerald-500" : "bg-muted-foreground/40"
            )}
          />
          {lastActive}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {canManage ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("actions", { name: person.name })}
                  />
                }
              >
                <DotsHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
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
              organizationId={organizationId}
              open={removing}
              onOpenChange={setRemoving}
            />
          </>
        ) : null}
      </td>
    </tr>
  )
}

/** A pending, expired, canceled or declined invitation; owner only. */
function InvitationRow({
  invitation,
  organizationId,
}: {
  invitation: Invitation
  organizationId: string
}) {
  const t = useTranslations("Collaborators")
  const locale = useLocale()
  const resend = useResendInvitation(organizationId)
  const cancel = useCancelInvitation(organizationId)

  const expired =
    invitation.status === "pending" &&
    new Date(invitation.expiresAt) < new Date()
  const status = expired ? "expired" : invitation.status
  const isOpen = status === "pending"

  const detail = isOpen
    ? t("expiresIn", {
        time:
          formatRelative(invitation.expiresAt, locale) ??
          formatDate(invitation.expiresAt, locale),
      })
    : t(`status.${status as "expired" | "canceled" | "rejected"}`)

  return (
    <tr className="border-b transition-colors last:border-b-0 hover:bg-secondary/40">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            name={invitation.email}
            className={cn("size-9", !isOpen && "opacity-60")}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{invitation.email}</span>
            <span className="truncate text-xs text-muted-foreground">
              {isOpen ? t("awaiting") : detail}
            </span>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <InvitationBadge status={status} />
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-foreground/80 md:table-cell">
        {formatDate(invitation.createdAt, locale)}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
        {isOpen ? detail : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("actions", { name: invitation.email })}
              />
            }
          >
            <DotsHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              disabled={resend.isPending}
              onClick={() => resend.mutate({ invitationId: invitation.id })}
            >
              <SendIcon size={16} />
              {isOpen || expired ? t("resend") : t("reinvite")}
            </DropdownMenuItem>
            {isOpen || expired ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(invitation.id)}
              >
                <X size={16} />
                {t("cancelInvitation")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function InvitationBadge({ status }: { status: string }) {
  const t = useTranslations("Collaborators")
  const key = (
    ["pending", "expired", "canceled", "rejected"].includes(status)
      ? status
      : "canceled"
  ) as "pending" | "expired" | "canceled" | "rejected"

  return (
    <Badge
      variant="outline"
      className={cn(
        key === "pending" &&
          "border-sky-300/60 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
        key === "expired" &&
          "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
        (key === "canceled" || key === "rejected") && "text-muted-foreground"
      )}
    >
      {t(`status.${key}`)}
    </Badge>
  )
}

function RoleBadge({ role }: { role: Collaborator["role"] }) {
  const t = useTranslations("Collaborators")

  return role === "owner" ? (
    <Badge
      variant="outline"
      className="border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
    >
      <Crown size={12} />
      {t("owner")}
    </Badge>
  ) : (
    <Badge variant="outline">{t("collaborator")}</Badge>
  )
}

function useInviteSchema() {
  const t = useTranslations("Validation")

  return useMemo(() => z.object({ email: z.email(t("emailInvalid")) }), [t])
}

/** Owner only: the button that opens the invite form. */
function InviteDialog({ organizationId }: { organizationId: string }) {
  const t = useTranslations("Collaborators")
  const [open, setOpen] = useState(false)
  const invite = useInviteCollaborator(organizationId)
  const schema = useInviteSchema()

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
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
      <DialogTrigger render={<Button />}>
        <UserPlus size={16} />
        {t("invite")}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader className="mb-6 flex-row items-center gap-3 text-left">
          <SettingsIcon className="size-10 [&_svg]:size-5">
            <UserPlus />
          </SettingsIcon>
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-xl font-semibold">
              {t("inviteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("inviteSubtitle")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit((values) =>
            invite.mutate(
              { email: values.email.toLowerCase() },
              {
                onSuccess: () => {
                  setOpen(false)
                  form.reset()
                },
              }
            )
          )}
        >
          <Field>
            <Label htmlFor="collaborator-email" className="font-semibold">
              {t("emailLabel")}
            </Label>
            <IconInput icon={<Mail size={16} />}>
              <Input
                id="collaborator-email"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                placeholder={t("emailPlaceholder")}
                disabled={invite.isPending}
                className="pl-10"
                aria-invalid={Boolean(errors.email)}
                aria-describedby="collaborator-email-error"
                {...form.register("email")}
              />
            </IconInput>
            <FieldError id="collaborator-email-error">
              {errors.email?.message}
            </FieldError>
          </Field>

          <p className="text-xs text-pretty text-muted-foreground">
            {t("inviteDescription", { days: INVITATION_EXPIRES_IN_DAYS })}
          </p>

          <Button type="submit" disabled={invite.isPending} className="w-full">
            {invite.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("inviteSubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** An input with an icon inside its left edge; give the input `pl-10`. */
function IconInput({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
      >
        {icon}
      </span>
      {children}
    </div>
  )
}

function RemoveDialog({
  person,
  organizationId,
  open,
  onOpenChange,
}: {
  person: Collaborator
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Collaborators")
  const tCommon = useTranslations("Common")
  const remove = useRemoveCollaborator(organizationId)

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
              remove.mutate(person.memberId, {
                onSuccess: () => onOpenChange(false),
              })
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
