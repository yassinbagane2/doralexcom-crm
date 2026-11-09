"use client"

import { leaseStatus, localToday } from "@workspace/api/lease"
import { PROPERTY_TYPES, type PropertyType } from "@workspace/api/property"
import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Input } from "@workspace/ui/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/ui/sheet"
import {
  Building2,
  Contact,
  Copy,
  DotsHorizontal,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  SearchIcon,
  Trash,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useDeferredValue, useMemo, useState } from "react"

import {
  EMPTY_PROPERTY,
  PropertyForm,
  toFormValues,
} from "@/components/properties/property-form"
import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import { LeaseDialog } from "@/components/tenants/lease-dialogs"
import { UserAvatar } from "@/components/user-avatar"
import { routes } from "@/config/routes"
import {
  useCreateProperty,
  useDeleteProperty,
  useProperties,
  useUpdateProperty,
  type Property,
} from "@/hooks/queries/property"
import { formatArea, formatDate, formatMoney } from "@/lib/format"

type PropertyLease = Property["leases"][number]

/** Who's in the property today, and who moves in next. */
function occupancy(property: Property, today: string) {
  let current: PropertyLease | null = null
  let next: PropertyLease | null = null
  for (const lease of property.leases) {
    const status = leaseStatus(lease, today)
    if (status === "active" || status === "ending") current = lease
    else if (status === "upcoming") next ??= lease
  }
  return { current, next }
}

type Editor =
  | { mode: "create" }
  | { mode: "edit"; property: Property }
  | { mode: "copy"; property: Property }

type TypeFilter = "all" | PropertyType

/** A business's properties: what it rents out, and who lives or works there. */
export function BusinessProperties() {
  const t = useTranslations("Properties")
  const locale = useLocale()
  const { data: properties, isPending } = useProperties()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [deleting, setDeleting] = useState<Property | null>(null)
  const [assigning, setAssigning] = useState<Property | null>(null)
  // The dialog keeps its property while it animates closed.
  const [assignTarget, setAssignTarget] = useState<Property | null>(null)
  if (assigning && assigning !== assignTarget) setAssignTarget(assigning)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<TypeFilter>("all")
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase())
  const today = localToday()

  // "Apt. 2" before "Apt. 10".
  const sorted = useMemo(() => {
    const collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base",
    })
    return [...(properties ?? [])].sort((a, b) =>
      collator.compare(a.name, b.name)
    )
  }, [properties, locale])

  const visible = sorted.filter(
    (property) =>
      (type === "all" || property.type === type) &&
      (!deferredSearch ||
        [
          property.name,
          property.address,
          ...property.leases.map((lease) => lease.tenant.name),
        ]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(deferredSearch)))
  )

  // Only offer filters for kinds the business actually has.
  const presentTypes = PROPERTY_TYPES.filter((value) =>
    sorted.some((property) => property.type === value)
  )
  const occupied = sorted.filter(
    (property) => occupancy(property, today).current
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length > 0
              ? t("summary", {
                  total: sorted.length,
                  occupied,
                  vacant: sorted.length - occupied,
                })
              : t("description")}
          </p>
        </div>
        <Button
          className="self-start sm:self-auto"
          onClick={() => setEditor({ mode: "create" })}
        >
          <Plus size={16} />
          {t("add")}
        </Button>
      </div>

      {sorted.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-md border px-2.5 sm:w-72">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          {presentTypes.length > 1 ? (
            <div
              role="radiogroup"
              aria-label={t("filterLabel")}
              className="flex flex-wrap gap-1"
            >
              {(["all", ...presentTypes] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={type === value}
                  onClick={() => setType(value)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                    type === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {value === "all" ? t("filterAll") : t(`typesPlural.${value}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-18 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="size-4.5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => setEditor({ mode: "create" })}
          >
            <Plus size={14} />
            {t("add")}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((property) => (
            <PropertyRow
              key={property.id}
              property={property}
              today={today}
              onEdit={() => setEditor({ mode: "edit", property })}
              onCopy={() => setEditor({ mode: "copy", property })}
              onAssign={() => setAssigning(property)}
              onDelete={() => setDeleting(property)}
            />
          ))}
        </ul>
      )}

      <PropertySheet editor={editor} onClose={() => setEditor(null)} />
      <DeletePropertyDialog
        property={deleting}
        today={today}
        onClose={() => setDeleting(null)}
      />
      {assignTarget ? (
        <LeaseDialog
          property={assignTarget}
          open={assigning !== null}
          onOpenChange={(open) => !open && setAssigning(null)}
        />
      ) : null}
    </div>
  )
}

function PropertyRow({
  property,
  today,
  onEdit,
  onCopy,
  onAssign,
  onDelete,
}: {
  property: Property
  today: string
  onEdit: () => void
  onCopy: () => void
  onAssign: () => void
  onDelete: () => void
}) {
  const t = useTranslations("Properties")
  const locale = useLocale()
  const facts = [
    property.surfaceArea !== null
      ? formatArea(property.surfaceArea, locale)
      : null,
    property.rent !== null
      ? t("perMonth", {
          amount: formatMoney(property.rent, property.currency, locale),
        })
      : null,
  ].filter(Boolean)
  const { current, next } = occupancy(property, today)

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("editLabel", { name: property.name })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <PropertyTypeIcon type={property.type} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{property.name}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {t(`types.${property.type}`)}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{property.address}</span>
          </span>
          {facts.length > 0 ? (
            <span className="text-xs text-muted-foreground sm:hidden">
              {facts.join(" · ")}
            </span>
          ) : null}
        </span>
        <span className="hidden w-32 shrink-0 flex-col items-end text-xs text-muted-foreground tabular-nums sm:flex">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </span>
      </button>
      <OccupantCell current={current} next={next} onAssign={onAssign} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("actionsLabel", { name: property.name })}
            />
          }
        >
          <DotsHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="size-4" />
            {t("copy")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAssign}>
            <Contact className="size-4" />
            {t("assignTenant")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash size={16} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function OccupantCell({
  current,
  next,
  onAssign,
}: {
  current: PropertyLease | null
  next: PropertyLease | null
  onAssign: () => void
}) {
  const t = useTranslations("Properties")
  const locale = useLocale()

  if (!current) {
    return (
      <span className="flex shrink-0 flex-col items-end gap-1 md:w-44">
        <Badge variant="outline">{t("vacant")}</Badge>
        {next ? null : (
          <button
            type="button"
            onClick={onAssign}
            className="hidden text-xs text-muted-foreground hover:text-foreground hover:underline md:block"
          >
            {t("assignTenant")}
          </button>
        )}
        {next ? (
          <Link
            href={`${routes.tenants}/${next.tenant.id}`}
            className="hidden max-w-44 truncate text-xs text-muted-foreground hover:text-foreground hover:underline md:block"
          >
            {t("incoming", {
              name: next.tenant.name,
              date: formatDate(next.startDate, locale),
            })}
          </Link>
        ) : null}
      </span>
    )
  }

  return (
    <Link
      href={`${routes.tenants}/${current.tenant.id}`}
      aria-label={t("viewTenant", { name: current.tenant.name })}
      className="flex min-w-0 shrink-0 items-center gap-2 rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 md:w-44"
    >
      <UserAvatar name={current.tenant.name} className="size-7" />
      <span className="hidden min-w-0 flex-col md:flex">
        <span className="truncate text-sm">{current.tenant.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {current.endDate
            ? t("leaving", { date: formatDate(current.endDate, locale) })
            : (current.tenant.email ?? t("occupied"))}
        </span>
      </span>
    </Link>
  )
}

function PropertySheet({
  editor,
  onClose,
}: {
  editor: Editor | null
  onClose: () => void
}) {
  const t = useTranslations("Properties")
  const create = useCreateProperty()
  const update = useUpdateProperty()
  // Keep showing the last editor while the sheet animates closed.
  const [shown, setShown] = useState(editor)
  if (editor && editor !== shown) setShown(editor)

  const mode = shown?.mode ?? "create"
  const source = shown && shown.mode !== "create" ? shown.property : null
  const defaultValues = !source
    ? EMPTY_PROPERTY
    : mode === "copy"
      ? {
          ...toFormValues(source),
          name: t("copyName", { name: source.name }),
        }
      : toFormValues(source)

  return (
    <Sheet
      open={editor !== null}
      onOpenChange={(open) => {
        if (open) return
        onClose()
        create.reset()
        update.reset()
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t(`sheet.${mode}.title`)}</SheetTitle>
          <SheetDescription>
            {source
              ? t(`sheet.${mode}.description`, { name: source.name })
              : t("sheet.create.description")}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <PropertyForm
            // A fresh form for each property, so the last one's values never leak in.
            key={`${mode}-${source?.id ?? "new"}`}
            defaultValues={defaultValues}
            submitLabel={t(`sheet.${mode}.submit`)}
            isPending={create.isPending || update.isPending}
            onSubmit={(input) => {
              if (mode === "edit" && source) {
                update.mutate(
                  { ...input, id: source.id },
                  { onSuccess: onClose }
                )
              } else {
                create.mutate(input, { onSuccess: onClose })
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Deleting is refused while a lease holds the property, now or later. The
 * server makes the same check (and refuses once rent has been paid on it);
 * this just says so up front and points to the tenant.
 */
function DeletePropertyDialog({
  property,
  today,
  onClose,
}: {
  property: Property | null
  today: string
  onClose: () => void
}) {
  const t = useTranslations("Properties")
  const tCommon = useTranslations("Common")
  const remove = useDeleteProperty()
  const [shown, setShown] = useState(property)
  if (property && property !== shown) setShown(property)

  const holder = shown
    ? (() => {
        const { current, next } = occupancy(shown, today)
        return current ?? next
      })()
    : null
  const tenant = holder?.tenant

  return (
    <Dialog
      open={property !== null}
      onOpenChange={(open) => {
        if (open) return
        onClose()
        remove.reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {tenant
              ? t("inUseTitle", { name: shown?.name ?? "" })
              : t("deleteTitle", { name: shown?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {tenant
              ? t("inUseDescription", { tenant: tenant.name })
              : t("deleteDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          {tenant ? (
            <Button render={<Link href={`${routes.tenants}/${tenant.id}`} />}>
              {t("viewTenantShort")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={remove.isPending || !shown}
              onClick={() =>
                shown && remove.mutate({ id: shown.id }, { onSuccess: onClose })
              }
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("deleteSubmit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
