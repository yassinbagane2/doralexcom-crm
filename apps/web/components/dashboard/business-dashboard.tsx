"use client"

import { localToday } from "@workspace/api/lease"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Building2,
  CalendarClock,
  CheckIcon,
  ChevronRightIcon,
  FilePen,
  HandCoins,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"

import { Section, SectionEmpty } from "@/components/customers/section"
import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import { UserAvatar } from "@/components/shared/user-avatar"
import { newPropertyRoute, propertyRoute, routes } from "@/config/routes"
import {
  useDashboardOverview,
  type DashboardOverview,
} from "@/hooks/queries/dashboard"
import { formatMoney } from "@/lib/format"

type Money = DashboardOverview["rent"]["billed"][number]
type Task = DashboardOverview["tasks"][number]
type RentRow = DashboardOverview["rent"]["leases"][number]
type Renewal = DashboardOverview["renewals"][number]

const customerRoute = (id: string) => `${routes.customers}/${id}`

/** "1.200 lei + €300": each currency apart, never converted. */
function useFormatTotals(fallback: string) {
  const locale = useLocale()
  return (totals: Money[]) =>
    totals.length === 0
      ? formatMoney(0, fallback, locale)
      : totals
          .map(({ amount, currency }) => formatMoney(amount, currency, locale))
          .join(" + ")
}

/** "today", "tomorrow", "in 12 days". */
function useWhen() {
  const t = useTranslations("Dashboard.renewals")
  return (days: number) =>
    days <= 0
      ? t("today")
      : days === 1
        ? t("tomorrow")
        : t("inDays", { count: days })
}

function daysUntil(today: string, day: string) {
  return Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000)
}

/** The business's home: occupancy, rent, renewals and what needs doing. */
export function BusinessDashboard() {
  const t = useTranslations("Dashboard")
  const locale = useLocale()
  const today = localToday()
  const { data, isPending, isError, refetch } = useDashboardOverview(today)

  const header = (
    <header className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-foreground first-letter:uppercase">
        {new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
      </p>
    </header>
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="size-3.5" />
            {t("retry")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OccupancyTile occupancy={data.occupancy} />
        <CollectedTile rent={data.rent} />
        <OutstandingTile rent={data.rent} />
        <RenewalsTile renewals={data.renewals} />
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <Tasks tasks={data.tasks} today={data.today} />
          <RentStatus rent={data.rent} />
        </div>
        <aside className="flex min-w-0 flex-col gap-10">
          <Renewals renewals={data.renewals} />
          <OccupancyByType occupancy={data.occupancy} />
        </aside>
      </div>
    </div>
  )
}

// --- Key figures --------------------------------------------------------------

function Tile({
  label,
  value,
  caption,
  href,
  children,
  tone = "default",
}: {
  label: string
  value: ReactNode
  caption?: ReactNode
  href?: string
  children?: ReactNode
  tone?: "default" | "warning"
}) {
  const body = (
    <>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-heading text-3xl font-medium tracking-[-0.03em] tabular-nums",
          tone === "warning" && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </span>
      {children}
      {caption ? (
        <span className="mt-auto truncate text-xs text-muted-foreground">
          {caption}
        </span>
      ) : null}
    </>
  )
  const className =
    "flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/40 p-5 outline-none"

  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** A thin bar split into coloured parts, in proportion to their values. */
function SplitBar({
  parts,
  className,
}: {
  parts: { value: number; className: string }[]
  className?: string
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  return (
    <div
      className={cn(
        "flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      {total > 0
        ? parts
            .filter((part) => part.value > 0)
            .map((part, index) => (
              <span
                key={index}
                className={cn("h-full rounded-full", part.className)}
                style={{ width: `${(part.value / total) * 100}%` }}
              />
            ))
        : null}
    </div>
  )
}

function OccupancyTile({
  occupancy,
}: {
  occupancy: DashboardOverview["occupancy"]
}) {
  const t = useTranslations("Dashboard.occupancy")
  const { total, occupied, incoming } = occupancy

  if (total === 0) {
    return (
      <Tile
        label={t("title")}
        value="—"
        caption={t("addProperty")}
        href={newPropertyRoute()}
      />
    )
  }

  const rate = Math.round((occupied / total) * 100)
  return (
    <Tile
      label={t("title")}
      value={`${rate}%`}
      href={routes.properties}
      caption={
        incoming > 0
          ? `${t("rented", { occupied, total })} · ${t("incoming", { count: incoming })}`
          : t("rented", { occupied, total })
      }
    >
      <SplitBar
        parts={[
          { value: occupied, className: "bg-emerald-500" },
          { value: incoming, className: "bg-sky-500" },
          {
            value: total - occupied - incoming,
            className: "bg-foreground/10",
          },
        ]}
      />
    </Tile>
  )
}

function CollectedTile({ rent }: { rent: DashboardOverview["rent"] }) {
  const t = useTranslations("Dashboard.collected")
  const fallback = rent.billed[0]?.currency ?? "RON"
  const format = useFormatTotals(fallback)
  // A progress bar only means something in a single currency.
  const single =
    rent.billed.length === 1 &&
    rent.collected.every((c) => c.currency === rent.billed[0]!.currency)
  const billed = single ? rent.billed[0]!.amount : 0
  const collected = single ? (rent.collected[0]?.amount ?? 0) : 0

  return (
    <Tile
      label={t("title")}
      value={format(rent.collected)}
      caption={
        rent.billed.length > 0
          ? t("ofBilled", { amount: format(rent.billed) })
          : t("nothingBilled")
      }
    >
      {single && billed > 0 ? (
        <SplitBar
          parts={[
            {
              value: Math.min(collected, billed),
              className: "bg-foreground",
            },
            {
              value: Math.max(billed - collected, 0),
              className: "bg-transparent",
            },
          ]}
        />
      ) : null}
    </Tile>
  )
}

function OutstandingTile({ rent }: { rent: DashboardOverview["rent"] }) {
  const t = useTranslations("Dashboard.outstanding")
  const format = useFormatTotals(rent.leases[0]?.currency ?? "RON")
  const behind = rent.counts.overdue

  return (
    <Tile
      label={t("title")}
      value={format(rent.outstanding)}
      tone={behind > 0 ? "warning" : "default"}
      caption={behind > 0 ? t("behind", { count: behind }) : t("allPaid")}
    />
  )
}

function RenewalsTile({ renewals }: { renewals: Renewal[] }) {
  const t = useTranslations("Dashboard.renewalsKpi")
  const when = useWhen()
  const next = renewals[0]

  return (
    <Tile
      label={t("title")}
      value={renewals.length}
      caption={
        next
          ? t("next", { name: next.customer.name, when: when(next.daysLeft) })
          : t("window")
      }
    />
  )
}

// --- Tasks --------------------------------------------------------------------

const TASK_ICONS: Record<Task["kind"], LucideIcon> = {
  collectRent: HandCoins,
  decideRenewal: CalendarClock,
  reviewRenewal: RefreshCw,
  prepareMoveIn: KeyRound,
  addContract: FilePen,
  findCustomer: Building2,
}

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-background text-muted-foreground shadow-xs",
}

const VISIBLE_TASKS = 6

function Tasks({ tasks, today }: { tasks: Task[]; today: string }) {
  const t = useTranslations("Dashboard.tasks")
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? tasks : tasks.slice(0, VISIBLE_TASKS)

  return (
    <Section title={t("title")} count={tasks.length}>
      {tasks.length === 0 ? (
        <SectionEmpty
          icon={<CheckIcon />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <ul className="-mx-3 flex flex-col">
            {shown.map((task) => (
              <TaskRow key={task.id} task={task} today={today} />
            ))}
          </ul>
          {tasks.length > VISIBLE_TASKS ? (
            <ShowMore
              expanded={expanded}
              onToggle={() => setExpanded((value) => !value)}
              more={t("showAll", { count: tasks.length })}
              less={t("showLess")}
            />
          ) : null}
        </>
      )}
    </Section>
  )
}

function TaskRow({ task, today }: { task: Task; today: string }) {
  const t = useTranslations("Dashboard.tasks")
  const locale = useLocale()
  const when = useWhen()
  const Icon = TASK_ICONS[task.kind]
  const values = {
    customer: task.customer?.name ?? "",
    property: task.property.name,
    amount: task.amount
      ? formatMoney(task.amount.amount, task.amount.currency, locale)
      : "",
    when: task.date ? when(daysUntil(today, task.date)) : "",
  }
  const href = task.customer
    ? customerRoute(task.customer.id)
    : propertyRoute(task.property.id)

  return (
    <li>
      <Link
        href={href}
        className="group/task flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            PRIORITY_STYLES[task.priority]
          )}
          title={t(`priority.${task.priority}`)}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {t(`${task.kind}.title`, values)}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {t(`${task.kind}.detail`, values)}
          </span>
        </span>
        <span className="sr-only">{t(`priority.${task.priority}`)}</span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover/task:translate-x-0.5" />
      </Link>
    </li>
  )
}

function ShowMore({
  expanded,
  onToggle,
  more,
  less,
}: {
  expanded: boolean
  onToggle: () => void
  more: string
  less: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start text-muted-foreground"
      onClick={onToggle}
    >
      {expanded ? less : more}
    </Button>
  )
}

// --- Rent ---------------------------------------------------------------------

const RENT_DOTS: Record<RentRow["status"], string> = {
  overdue: "bg-red-500",
  due: "bg-amber-500",
  paid: "bg-emerald-500",
}

const VISIBLE_RENTS = 8

function RentStatus({ rent }: { rent: DashboardOverview["rent"] }) {
  const t = useTranslations("Dashboard.rent")
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rent.leases : rent.leases.slice(0, VISIBLE_RENTS)
  const statuses = ["overdue", "due", "paid"] as const

  return (
    <Section title={t("title")} count={rent.leases.length}>
      {rent.leases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-4">
            <SplitBar
              className="h-2"
              parts={statuses.map((status) => ({
                value: rent.counts[status],
                className: RENT_DOTS[status],
              }))}
            />
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {statuses.map((status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", RENT_DOTS[status])}
                  />
                  <span className="text-muted-foreground">{t(status)}</span>
                  <span className="font-medium tabular-nums">
                    {rent.counts[status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="-mx-3 flex flex-col">
            {shown.map((row) => (
              <RentRowItem key={row.leaseId} row={row} />
            ))}
          </ul>
          {rent.leases.length > VISIBLE_RENTS ? (
            <ShowMore
              expanded={expanded}
              onToggle={() => setExpanded((value) => !value)}
              more={t("showAll", { count: rent.leases.length })}
              less={t("showLess")}
            />
          ) : null}
        </>
      )}
    </Section>
  )
}

function RentRowItem({ row }: { row: RentRow }) {
  const t = useTranslations("Dashboard.rent")
  const locale = useLocale()
  const date = (day: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      // Plain calendar days: read them as UTC so no timezone shifts them.
      timeZone: "UTC",
    }).format(new Date(day))

  return (
    <li>
      <Link
        href={customerRoute(row.customer.id)}
        className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={row.customer.name} className="size-8 text-[10px]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {row.customer.name}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <PropertyTypeIcon type={row.property.type} className="size-3" />
            <span className="truncate">{row.property.name}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm tabular-nums",
              row.status === "overdue" &&
                "font-medium text-red-600 dark:text-red-400"
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", RENT_DOTS[row.status])}
            />
            {row.status === "overdue"
              ? t("owes", {
                  amount: formatMoney(row.balance, row.currency, locale),
                })
              : t(row.status)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.nextDue
              ? row.status === "paid"
                ? t("paidUntil", { date: date(row.nextDue) })
                : t("dueOn", { date: date(row.nextDue) })
              : t("settled")}
          </span>
        </span>
      </Link>
    </li>
  )
}

// --- Renewals -----------------------------------------------------------------

function Renewals({ renewals }: { renewals: Renewal[] }) {
  const t = useTranslations("Dashboard.renewals")

  return (
    <Section title={t("title")} count={renewals.length}>
      {renewals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {renewals.map((renewal) => (
            <RenewalRow key={renewal.leaseId} renewal={renewal} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function RenewalRow({ renewal }: { renewal: Renewal }) {
  const t = useTranslations("Dashboard.renewals")
  const locale = useLocale()
  const when = useWhen()
  const day = new Date(renewal.date)
  const urgent = renewal.kind === "ends" && renewal.daysLeft <= 14

  return (
    <li>
      <Link
        href={customerRoute(renewal.customer.id)}
        className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
            urgent
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-muted/60"
          )}
        >
          <span className="text-[10px] font-medium uppercase opacity-70">
            {new Intl.DateTimeFormat(locale, {
              month: "short",
              timeZone: "UTC",
            }).format(day)}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {day.getUTCDate()}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {renewal.customer.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {renewal.property.name} ·{" "}
            {renewal.kind === "renews"
              ? t("renews")
              : renewal.followedBy
                ? t("endsFollowed", { name: renewal.followedBy.name })
                : t("ends")}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            urgent
              ? "font-medium text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          )}
        >
          {when(renewal.daysLeft)}
        </span>
      </Link>
    </li>
  )
}

// --- Occupancy by type --------------------------------------------------------

function OccupancyByType({
  occupancy,
}: {
  occupancy: DashboardOverview["occupancy"]
}) {
  const t = useTranslations("Dashboard.occupancy")
  const tp = useTranslations("Properties")

  if (occupancy.total === 0) {
    return (
      <Section title={t("byTypeTitle")}>
        <SectionEmpty
          icon={<Building2 />}
          title={t("noProperties")}
          action={
            <Button
              size="sm"
              variant="outline"
              render={<Link href={newPropertyRoute()} />}
            >
              <Plus size={14} />
              {t("addProperty")}
            </Button>
          }
        />
      </Section>
    )
  }

  return (
    <Section title={t("byTypeTitle")}>
      <ul className="flex flex-col gap-4">
        {occupancy.byType.map((row) => (
          <li key={row.type} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <PropertyTypeIcon
                  type={row.type}
                  className="text-muted-foreground"
                />
                {tp(`typesPlural.${row.type}`)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {row.occupied}/{row.total}
              </span>
            </div>
            <SplitBar
              parts={[
                { value: row.occupied, className: "bg-emerald-500" },
                {
                  value: row.total - row.occupied,
                  className: "bg-transparent",
                },
              ]}
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}
