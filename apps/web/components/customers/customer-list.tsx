"use client"

import {
  leaseBalance,
  leaseStatus,
  localToday,
  CUSTOMER_GROUPS,
  type LeaseDates,
  type CustomerGroup,
} from "@workspace/api/lease"
import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { Input } from "@workspace/ui/components/ui/input"
import {
  Contact,
  Copy,
  DotsHorizontal,
  Plus,
  SearchIcon,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import {
  CustomerSheet,
  type CustomerEditor,
} from "@/components/customers/customer-sheet"
import { InfiniteScrollTrigger } from "@/components/shared/infinite-scroll-trigger"
import { UserAvatar } from "@/components/user-avatar"
import { routes } from "@/config/routes"
import {
  useCustomerGroupCounts,
  useCustomerPages,
  type CustomerSummary,
} from "@/hooks/queries/customer"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatDate, formatMoney } from "@/lib/format"

type Filter = "all" | CustomerGroup

/** What each customer owes across its leases, one amount per currency. */
export function outstanding(
  leases: CustomerSummary["leases"],
  today: string
): { currency: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const lease of leases) {
    const { balance } = leaseBalance(lease, lease.paid, today)
    totals.set(lease.currency, (totals.get(lease.currency) ?? 0) + balance)
  }
  return [...totals]
    .map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    }))
    .filter(({ amount }) => amount !== 0)
}

/**
 * Everyone a business rents to, sorted into who lives there now, who's moving
 * in, who's moving out, and who has left.
 */
export function CustomerList() {
  const t = useTranslations("Customers")
  const [editor, setEditor] = useState<CustomerEditor | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const searched = useDebouncedValue(search.trim())
  const today = localToday()
  const counts = useCustomerGroupCounts(today)
  const pages = useCustomerPages({
    search: searched,
    group: filter === "all" ? undefined : filter,
    today,
  })
  const customers = pages.data?.pages.flatMap((page) => page.data) ?? []
  const total = counts.data?.all ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          className="self-start sm:self-auto"
          onClick={() => setEditor({ mode: "create" })}
        >
          <Plus size={16} />
          {t("add")}
        </Button>
      </div>

      {total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="radiogroup"
            aria-label={t("filterLabel")}
            className="flex flex-wrap gap-1"
          >
            {(["all", ...CUSTOMER_GROUPS] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                  filter === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {t(`groups.${value}`)}
                <span className="tabular-nums opacity-60">
                  {counts.data?.[value] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-md border px-2.5 sm:w-64">
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
        </div>
      ) : null}

      {pages.isPending || counts.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Contact className="size-4.5" />
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
      ) : customers.length === 0 ? (
        <p className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
          {filter !== "all" && !searched
            ? t(`groupsEmpty.${filter}`)
            : t("noResults")}
        </p>
      ) : (
        <div
          className={cn(
            "flex flex-col transition-opacity",
            pages.isPlaceholderData && "opacity-60"
          )}
        >
          <ul className="divide-y rounded-lg border">
            {customers.map((customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                today={today}
                onCopy={() =>
                  setEditor({ mode: "copy", customerId: customer.id })
                }
              />
            ))}
            {pages.isFetchingNextPage
              ? [0, 1, 2].map((i) => (
                  <li key={`loading-${i}`} className="px-4 py-3">
                    <div className="h-9 animate-pulse rounded-md bg-muted" />
                  </li>
                ))
              : null}
          </ul>
          <InfiniteScrollTrigger query={pages} />
        </div>
      )}

      <CustomerSheet editor={editor} onClose={() => setEditor(null)} />
    </div>
  )
}

function CustomerRow({
  customer,
  today,
  onCopy,
}: {
  customer: CustomerSummary
  today: string
  onCopy: () => void
}) {
  const t = useTranslations("Customers")
  const locale = useLocale()
  const owed = outstanding(customer.leases, today).filter((o) => o.amount > 0)

  // The lease that best says where the customer stands: the one they're in,
  // else the next one, else the last one they left.
  const ranked = [...customer.leases].sort(
    (a, b) =>
      rank(leaseStatus(a, today)) - rank(leaseStatus(b, today)) ||
      b.startDate.localeCompare(a.startDate)
  )
  const headline = ranked[0]
  const others = customer.leases.length - 1

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link
        href={`${routes.customers}/${customer.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={customer.name} className="size-9" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{customer.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {[customer.email, customer.phone].filter(Boolean).join(" · ") ||
              t("noContactDetails")}
          </span>
        </span>
        <span className="hidden min-w-0 flex-col items-end gap-1 text-xs sm:flex">
          {headline ? (
            <>
              <LeaseBadge lease={headline} today={today} />
              <span className="max-w-56 truncate text-muted-foreground">
                {headline.property.name}
                {others > 0 ? ` ${t("andMore", { count: others })}` : ""}
              </span>
            </>
          ) : (
            <Badge variant="outline">{t("noLease")}</Badge>
          )}
        </span>
        {owed.length > 0 ? (
          <span className="hidden w-28 shrink-0 flex-col items-end text-xs md:flex">
            <span className="text-muted-foreground">{t("owes")}</span>
            {owed.map(({ currency, amount }) => (
              <span
                key={currency}
                className="font-medium text-destructive tabular-nums"
              >
                {formatMoney(amount, currency, locale)}
              </span>
            ))}
          </span>
        ) : (
          <span className="hidden w-28 md:block" />
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("actionsLabel", { name: customer.name })}
            />
          }
        >
          <DotsHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="size-4" />
            {t("copy")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function rank(status: ReturnType<typeof leaseStatus>) {
  return { ending: 0, active: 0, upcoming: 1, ended: 2 }[status]
}

/** Where a lease stands, in a word and a date. */
export function LeaseBadge({
  lease,
  today,
}: {
  /** Pass the whole lease: a renewing one never shows as ending. */
  lease: LeaseDates
  today: string
}) {
  const t = useTranslations("Leases.status")
  const locale = useLocale()
  const status = leaseStatus(lease, today)

  switch (status) {
    case "upcoming":
      return (
        <Badge variant="secondary">
          {t("upcoming", { date: formatDate(lease.startDate, locale) })}
        </Badge>
      )
    case "ending":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-700 dark:text-amber-400"
        >
          {t("ending", { date: formatDate(lease.endDate!, locale) })}
        </Badge>
      )
    case "ended":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {t("ended", { date: formatDate(lease.endDate!, locale) })}
        </Badge>
      )
    default:
      return (
        <Badge>
          {t("active", { date: formatDate(lease.startDate, locale) })}
        </Badge>
      )
  }
}
