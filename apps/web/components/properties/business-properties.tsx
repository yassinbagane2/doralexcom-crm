"use client"

import { localToday } from "@workspace/api/lease"
import type { PropertyType } from "@workspace/api/property"
import { Button } from "@workspace/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Input } from "@workspace/ui/components/ui/input"
import {
  Building2,
  Copy,
  DotsHorizontal,
  Pencil,
  Plus,
  SearchIcon,
  Trash,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { SectionEmpty } from "@/components/customers/section"
import { PropertyCover } from "@/components/properties/property-cover"
import {
  DeletePropertyDialog,
  OccupancyPill,
  occupancy,
} from "@/components/properties/property-dialogs"
import { InfiniteScrollTrigger } from "@/components/shared/infinite-scroll-trigger"
import { UserAvatar } from "@/components/user-avatar"
import { newPropertyRoute, propertyRoute, routes } from "@/config/routes"
import {
  usePropertyPages,
  usePropertySummary,
  type Property,
} from "@/hooks/queries/property"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatArea, formatDate, formatMoney } from "@/lib/format"

type TypeFilter = "all" | PropertyType

const GRID =
  "grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"

/** A business's properties: what it rents out, and who lives or works there. */
export function BusinessProperties() {
  const t = useTranslations("Properties")
  const [deleting, setDeleting] = useState<Property | null>(null)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<TypeFilter>("all")
  const searched = useDebouncedValue(search.trim())
  const today = localToday()
  const summary = usePropertySummary(today)
  const pages = usePropertyPages({
    search: searched,
    type: type === "all" ? undefined : type,
  })
  const properties = pages.data?.pages.flatMap((page) => page.data) ?? []
  const total = summary.data?.total ?? 0
  const occupied = summary.data?.occupied ?? 0
  // Only offer filters for kinds the business actually has.
  const presentTypes = summary.data?.types ?? []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? t("summary", { total, occupied, vacant: total - occupied })
              : t("description")}
          </p>
        </div>
        <Button
          className="self-start sm:self-auto"
          render={<Link href={newPropertyRoute()} />}
        >
          <Plus size={16} />
          {t("add")}
        </Button>
      </div>

      {total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 transition-colors focus-within:bg-muted sm:w-80">
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
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
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

      {pages.isPending || summary.isPending ? (
        <ul className={GRID} aria-hidden>
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </ul>
      ) : total === 0 ? (
        <SectionEmpty
          icon={<Building2 />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="py-16"
          action={
            <Button
              variant="outline"
              size="sm"
              render={<Link href={newPropertyRoute()} />}
            >
              <Plus size={14} />
              {t("add")}
            </Button>
          }
        />
      ) : properties.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      ) : (
        <div
          className={cn(
            "flex flex-col transition-opacity",
            pages.isPlaceholderData && "opacity-60"
          )}
        >
          <ul className={GRID}>
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                today={today}
                onDelete={() => setDeleting(property)}
              />
            ))}
            {pages.isFetchingNextPage
              ? [0, 1, 2].map((i) => <CardSkeleton key={`loading-${i}`} />)
              : null}
          </ul>
          <InfiniteScrollTrigger query={pages} />
        </div>
      )}

      <DeletePropertyDialog
        property={deleting}
        today={today}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function CardSkeleton() {
  return (
    <li className="flex flex-col gap-3">
      <div className="aspect-[16/10] animate-pulse rounded-xl bg-muted" />
      <div className="flex flex-col gap-2 px-0.5">
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </li>
  )
}

function PropertyCard({
  property,
  today,
  onDelete,
}: {
  property: Property
  today: string
  onDelete: () => void
}) {
  const t = useTranslations("Properties")
  const locale = useLocale()
  const { current, next } = occupancy(property.leases, today)
  const href = propertyRoute(property.id)
  const details = [
    t(`types.${property.type}`),
    property.surfaceArea !== null
      ? formatArea(property.surfaceArea, locale)
      : null,
  ].filter(Boolean)

  return (
    <li className="group/card relative flex min-w-0 flex-col gap-3">
      <Link
        href={href}
        aria-label={property.name}
        className="flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PropertyCover
          type={property.type}
          className="aspect-[16/10] rounded-xl transition-[filter] group-hover/card:brightness-[0.97] dark:group-hover/card:brightness-110"
        >
          <OccupancyPill
            occupied={current !== null}
            className="absolute top-3 left-3 bg-background/90 shadow-xs backdrop-blur"
          />
        </PropertyCover>

        <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="truncate font-medium">{property.name}</span>
            {property.rent !== null ? (
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatMoney(property.rent, property.currency, locale)}
                <span className="font-normal text-muted-foreground">
                  {t("perMonthSuffix")}
                </span>
              </span>
            ) : null}
          </div>
          <span className="truncate text-sm text-muted-foreground">
            {property.address}
          </span>
          <span className="text-xs text-muted-foreground">
            {details.join(" · ")}
          </span>
        </div>
      </Link>

      {current || next ? (
        <div className="flex min-h-6 items-center px-0.5 text-xs">
          {current ? (
            <Link
              href={`${routes.customers}/${current.customer.id}`}
              aria-label={t("viewCustomer", { name: current.customer.name })}
              className="flex min-w-0 items-center gap-2 rounded-md text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <UserAvatar
                name={current.customer.name}
                className="size-5 text-[9px]"
              />
              <span className="truncate">{current.customer.name}</span>
              {current.endDate ? (
                <span className="shrink-0 text-muted-foreground">
                  ·{" "}
                  {t("leaving", { date: formatDate(current.endDate, locale) })}
                </span>
              ) : null}
            </Link>
          ) : next ? (
            <Link
              href={`${routes.customers}/${next.customer.id}`}
              className="truncate text-muted-foreground hover:text-foreground hover:underline"
            >
              {t("incoming", {
                name: next.customer.name,
                date: formatDate(next.startDate, locale),
              })}
            </Link>
          ) : null}
        </div>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={t("actionsLabel", { name: property.name })}
              className="absolute top-2.5 right-2.5 bg-background/90 shadow-xs backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 aria-expanded:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
            />
          }
        >
          <DotsHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={<Link href={propertyRoute(property.id, "edit")} />}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={newPropertyRoute(property.id)} />}
          >
            <Copy className="size-4" />
            {t("copy")}
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
