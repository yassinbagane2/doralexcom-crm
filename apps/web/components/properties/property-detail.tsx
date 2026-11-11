"use client"

import { leaseStatus, localToday } from "@workspace/api/lease"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Button } from "@workspace/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  ArrowLeftIcon,
  Check,
  Contact,
  Copy,
  DotsHorizontal,
  ExternalLink,
  HistoryIcon,
  KeyRound,
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash,
} from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"

import { LeaseDialog } from "@/components/customers/lease-dialogs"
import { LeaseBadge } from "@/components/customers/customer-list"
import { Section, SectionEmpty } from "@/components/customers/section"
import { PropertyCover } from "@/components/properties/property-cover"
import {
  DeletePropertyDialog,
  OccupancyPill,
  occupancy,
} from "@/components/properties/property-dialogs"
import { UserAvatar } from "@/components/user-avatar"
import { newPropertyRoute, propertyRoute, routes } from "@/config/routes"
import {
  useProperty,
  type PropertyDetail as Property,
} from "@/hooks/queries/property"
import {
  formatArea,
  formatDate,
  formatMoney,
  formatRelative,
} from "@/lib/format"

type PropertyLease = Property["leases"][number]

/** One property: what it is, who's in it, who was, and how to get in. */
export function PropertyDetail({ propertyId }: { propertyId: string }) {
  const t = useTranslations("Properties")
  const locale = useLocale()
  const router = useRouter()
  const { data: property, isPending, isError } = useProperty(propertyId)
  const [deleting, setDeleting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const today = localToday()

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !property) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" render={<Link href={routes.properties} />}>
          <ArrowLeftIcon isHovered className="size-4" />
          {t("back")}
        </Button>
      </div>
    )
  }

  const { current, next } = occupancy(property.leases, today)
  const upcoming = property.leases.filter(
    (lease) => leaseStatus(lease, today) === "upcoming"
  )
  const past = property.leases
    .filter((lease) => leaseStatus(lease, today) === "ended")
    .reverse()

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={routes.properties}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon isHovered className="size-4" />
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="font-heading text-3xl font-medium tracking-[-0.02em] wrap-break-word">
            {property.name}
          </h1>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 wrap-break-word">{property.address}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            render={<Link href={propertyRoute(property.id, "edit")} />}
          >
            <Pencil className="size-3.5" />
            {t("edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("actionsLabel", { name: property.name })}
                />
              }
            >
              <DotsHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                render={<Link href={newPropertyRoute(property.id)} />}
              >
                <Copy className="size-4" />
                {t("copy")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssigning(true)}>
                <Contact className="size-4" />
                {t("assignCustomer")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash size={16} />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <PropertyCover
        type={property.type}
        size="lg"
        className="aspect-[16/9] w-full rounded-2xl sm:aspect-[21/8]"
      >
        <OccupancyPill
          occupied={current !== null}
          className="absolute top-4 left-4 bg-background/90 shadow-xs backdrop-blur"
        />
      </PropertyCover>

      <KeyFacts property={property} current={current} past={past} />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <Section
            title={t("detail.occupancyTitle")}
            action={
              current || next ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAssigning(true)}
                >
                  <Plus size={14} />
                  {t("assignCustomer")}
                </Button>
              )
            }
          >
            {current || upcoming.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {current ? (
                  <OccupantRow lease={current} today={today} featured />
                ) : null}
                {upcoming.map((lease) => (
                  <OccupantRow key={lease.id} lease={lease} today={today} />
                ))}
              </ul>
            ) : (
              <SectionEmpty
                icon={<Contact />}
                title={t("detail.vacantTitle")}
                description={t("detail.vacantDescription")}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssigning(true)}
                  >
                    <Plus size={14} />
                    {t("assignCustomer")}
                  </Button>
                }
              />
            )}
          </Section>

          <Section title={t("fields.description")}>
            {property.description ? (
              <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">
                {property.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("detail.noDescription")}{" "}
                <Link
                  href={propertyRoute(property.id, "edit")}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {t("detail.addDescription")}
                </Link>
              </p>
            )}
          </Section>

          <Section title={t("detail.historyTitle")} count={past.length}>
            {past.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <HistoryIcon size={16} className="shrink-0" />
                {t("detail.historyEmpty")}
              </p>
            ) : (
              <ul className="-mx-3 flex flex-col">
                {past.map((lease) => (
                  <PastLeaseRow key={lease.id} lease={lease} />
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-6">
          <Access property={property} />
          <Location address={property.address} />
          <Section title={t("detail.recordTitle")}>
            <dl className="flex flex-col gap-2 text-sm">
              <RecordRow
                label={t("detail.added")}
                value={formatDate(property.createdAt, locale)}
              />
              <UpdatedRow updatedAt={property.updatedAt} />
            </dl>
          </Section>
        </aside>
      </div>

      <LeaseDialog
        property={property}
        open={assigning}
        onOpenChange={setAssigning}
      />
      <DeletePropertyDialog
        property={deleting ? property : null}
        today={today}
        onClose={() => setDeleting(false)}
        onDeleted={() => router.push(routes.properties)}
      />
    </div>
  )
}

/** The numbers people look for first, side by side. */
function KeyFacts({
  property,
  current,
  past,
}: {
  property: Property
  current: PropertyLease | null
  past: PropertyLease[]
}) {
  const t = useTranslations("Properties")
  const locale = useLocale()
  const money = (amount: number) =>
    formatMoney(amount, property.currency, locale)
  const lastLeft = past[0]?.endDate ?? null

  const facts: { label: string; value: ReactNode; hint?: ReactNode }[] = [
    {
      label: t("fields.rent"),
      value:
        property.rent !== null ? (
          <>
            {money(property.rent)}
            <span className="text-sm font-normal text-muted-foreground">
              {t("perMonthSuffix")}
            </span>
          </>
        ) : null,
    },
    {
      label: t("fields.surfaceArea"),
      value:
        property.surfaceArea !== null
          ? formatArea(property.surfaceArea, locale)
          : null,
      hint:
        property.rent && property.surfaceArea
          ? t("detail.perSquareMetre", {
              amount: money(
                Math.round((property.rent / property.surfaceArea) * 100) / 100
              ),
            })
          : undefined,
    },
    {
      label: t("detail.status"),
      value: current ? t("occupied") : t("vacant"),
      hint: current
        ? t("detail.since", { date: formatDate(current.startDate, locale) })
        : lastLeft
          ? t("detail.since", { date: formatDate(lastLeft, locale) })
          : undefined,
    },
    {
      label: t("detail.leasesCount"),
      value: property.leases.length,
    },
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-2xl bg-muted/40 p-5 sm:grid-cols-4">
      {facts.map(({ label, value, hint }) => (
        <div key={label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-lg font-medium tracking-[-0.01em] tabular-nums">
            {value ?? (
              <span className="text-muted-foreground/60">{t("notSet")}</span>
            )}
          </dd>
          {hint ? (
            <dd className="truncate text-xs text-muted-foreground">{hint}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  )
}

function OccupantRow({
  lease,
  today,
  featured = false,
}: {
  lease: PropertyLease
  today: string
  featured?: boolean
}) {
  const t = useTranslations("Properties")
  const locale = useLocale()

  return (
    <li>
      <Link
        href={`${routes.customers}/${lease.customer.id}`}
        aria-label={t("viewCustomer", { name: lease.customer.name })}
        className="group/occupant flex items-center gap-3 rounded-xl bg-muted/40 p-3 pr-4 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar
          name={lease.customer.name}
          className={featured ? "size-10 text-xs" : "size-8 text-[10px]"}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {lease.customer.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              lease.customer.email,
              lease.rent > 0
                ? t("perMonth", {
                    amount: formatMoney(lease.rent, lease.currency, locale),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <LeaseBadge lease={lease} today={today} />
      </Link>
    </li>
  )
}

function PastLeaseRow({ lease }: { lease: PropertyLease }) {
  const t = useTranslations("Properties")
  const locale = useLocale()

  return (
    <li>
      <Link
        href={`${routes.customers}/${lease.customer.id}`}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={lease.customer.name} className="size-7 text-[10px]" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {lease.customer.name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {t("detail.period", {
            start: formatDate(lease.startDate, locale),
            end: formatDate(lease.endDate ?? lease.startDate, locale),
          })}
        </span>
      </Link>
    </li>
  )
}

/** How to get in: the door code and the property's own phone. */
function Access({ property }: { property: Property }) {
  const t = useTranslations("Properties")

  return (
    <Section title={t("detail.accessTitle")}>
      {property.doorCode || property.phone ? (
        <dl className="flex flex-col gap-3 text-sm">
          {property.doorCode ? (
            <div className="flex items-center gap-2.5">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <dt className="text-xs text-muted-foreground">
                  {t("fields.doorCode")}
                </dt>
                <dd className="truncate font-mono tracking-wide">
                  {property.doorCode}
                </dd>
              </span>
              <CopyButton
                value={property.doorCode}
                label={t("detail.copyDoorCode")}
              />
            </div>
          ) : null}
          {property.phone ? (
            <div className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">
                  {t("fields.phone")}
                </dt>
                <dd>
                  <a
                    href={`tel:${property.phone}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {property.phone}
                  </a>
                </dd>
              </span>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("detail.accessEmpty")}
        </p>
      )}
    </Section>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("Properties")
  const [copied, setCopied] = useState(false)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          toast.success(t("detail.copied"))
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard refused (permissions, insecure context): nothing to undo.
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

function Location({ address }: { address: string }) {
  const t = useTranslations("Properties")
  const maps = `https://www.google.com/maps/search/?${new URLSearchParams({
    api: "1",
    query: address,
  })}`

  return (
    <Section title={t("detail.locationTitle")}>
      <p className="text-sm break-words">{address}</p>
      <a
        href={maps}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
        {t("detail.openInMaps")}
      </a>
    </Section>
  )
}

function RecordRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  )
}

function UpdatedRow({ updatedAt }: { updatedAt: Date }) {
  const t = useTranslations("Properties")
  const locale = useLocale()
  return (
    <RecordRow
      label={t("detail.updated")}
      value={formatRelative(updatedAt, locale) ?? t("detail.justNow")}
    />
  )
}
