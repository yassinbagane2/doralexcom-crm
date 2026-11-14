"use client"

import { localToday } from "@workspace/api/lease"
import { Button } from "@workspace/ui/components/ui/button"
import { Input } from "@workspace/ui/components/ui/input"
import { LoaderCircle, SearchIcon, SquarePen } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { InfinitePicker } from "@/components/shared/infinite-picker"
import { UserAvatar } from "@/components/shared/user-avatar"
import { inboxRoute } from "@/config/routes"
import {
  useConversations,
  useMyConversations,
  useOpenConversation,
} from "@/hooks/queries/conversation"
import {
  useCustomerPages,
  type CustomerSummary,
} from "@/hooks/queries/customer"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatRelative } from "@/lib/format"

import { Thread } from "./thread"

type Side = "business" | "customer"

/**
 * Messages between a business and its customers: the conversation list
 * beside the open conversation (one or the other on small screens), filling
 * the page. The open conversation lives in the address (`?conversation=`),
 * so notifications and other pages can link straight to one; `?customer=`
 * (businesses only) opens the one with that customer.
 */
export function InboxPage({ side }: { side: Side }) {
  const t = useTranslations("Inbox")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const selected = params.get("conversation")

  const select = (conversationId: string | null) =>
    router.replace(
      conversationId ? inboxRoute({ conversation: conversationId }) : pathname,
      { scroll: false }
    )

  useOpenCustomerFromAddress(side, select)

  return (
    <div
      className={cn(
        "grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card shadow-xs md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]",
        // Customers' pages grow with their content on small screens, above
        // the dock: there, the height is set here.
        side === "customer" && "max-md:h-[calc(100svh-6.5rem)] max-md:flex-none"
      )}
    >
      <aside
        className={cn(
          "flex min-h-0 flex-col md:border-r",
          selected && "max-md:hidden"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 pr-2.5 pl-4">
          <h1 className="font-heading text-lg font-medium tracking-[-0.02em]">
            {t("messages")}
          </h1>
          {side === "business" ? <NewConversation onOpened={select} /> : null}
        </div>
        {side === "business" ? (
          <BusinessConversations selected={selected} onSelect={select} />
        ) : (
          <CustomerConversations selected={selected} onSelect={select} />
        )}
      </aside>
      <section className={cn("min-h-0", !selected && "max-md:hidden")}>
        {selected ? (
          <Thread
            key={selected}
            conversationId={selected}
            onBack={() => select(null)}
          />
        ) : (
          <Empty text={t("selectConversation")} className="h-full" />
        )}
      </section>
    </div>
  )
}

/** `?customer=<id>`: open (or start) the business's conversation with them. */
function useOpenCustomerFromAddress(
  side: Side,
  select: (conversationId: string) => void
) {
  const params = useSearchParams()
  const customerId = side === "business" ? params.get("customer") : null
  const open = useOpenConversation()
  const handled = useRef<string | null>(null)
  const { mutate } = open

  useEffect(() => {
    if (!customerId || handled.current === customerId) return
    handled.current = customerId
    mutate(customerId, { onSuccess: ({ id }) => select(id) })
  }, [customerId, mutate, select])
}

function BusinessConversations({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (conversationId: string) => void
}) {
  const t = useTranslations("Inbox")
  const locale = useLocale()
  const [search, setSearch] = useState("")
  const searched = useDebouncedValue(search.trim())
  const conversations = useConversations(searched)
  const list = conversations.data ?? []

  return (
    <>
      <div className="px-2.5 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchConversations")}
            aria-label={t("searchConversations")}
            className="h-8 rounded-lg border-transparent bg-muted pl-8 shadow-none focus-visible:border-ring dark:bg-muted"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.isPending ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <Empty text={t(searched ? "noResults" : "noConversations")} />
        ) : (
          <ul className="flex flex-col gap-0.5 px-1.5 pb-1.5">
            {list.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                name={conversation.customer.name}
                preview={conversation.lastMessageBody}
                fromReader={conversation.lastMessageSide === "business"}
                at={conversation.lastMessageAt}
                unread={conversation.unread}
                active={conversation.id === selected}
                locale={locale}
                onClick={() => onSelect(conversation.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** Starts (or reopens) the conversation with a customer picked from a list. */
function NewConversation({
  onOpened,
}: {
  onOpened: (conversationId: string) => void
}) {
  const t = useTranslations("Inbox")
  const [search, setSearch] = useState("")
  const customers = useCustomerPages({
    search: useDebouncedValue(search.trim()),
    today: localToday(),
  })
  const open = useOpenConversation()

  return (
    <InfinitePicker<CustomerSummary>
      items={customers.data?.pages.flatMap((page) => page.data) ?? []}
      query={customers}
      value={null}
      onValueChange={(customer) =>
        open.mutate(customer.id, { onSuccess: ({ id }) => onOpened(id) })
      }
      search={search}
      onSearchChange={setSearch}
      itemLabel={(customer) => customer.name}
      renderItem={(customer) => (
        <>
          <UserAvatar name={customer.name} className="size-6 text-[10px]" />
          <span className="truncate">{customer.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {customer.email}
          </span>
        </>
      )}
      placeholder={t("newMessage")}
      searchPlaceholder={t("searchCustomers")}
      emptyText={t("noCustomers")}
      align="end"
      contentClassName="w-72"
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("newMessage")}
          title={t("newMessage")}
          className="text-muted-foreground hover:text-foreground"
        >
          {open.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <SquarePen className="size-4" />
          )}
        </Button>
      }
    />
  )
}

function CustomerConversations({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (conversationId: string) => void
}) {
  const t = useTranslations("Inbox")
  const locale = useLocale()
  const conversations = useMyConversations()
  const list = conversations.data ?? []
  const only = list.length === 1 ? list[0]?.id : undefined

  // Most customers rent from one business: open that conversation directly
  // (on wide screens; small ones keep the list as the first step).
  useEffect(() => {
    if (only && !selected && window.matchMedia("(min-width: 768px)").matches) {
      onSelect(only)
    }
  }, [only, selected, onSelect])

  if (conversations.isPending) return <ListSkeleton />
  if (list.length === 0) {
    return <Empty text={t("noBusinesses")} />
  }

  return (
    <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1.5 pb-1.5">
      {list.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          name={conversation.business.name}
          preview={conversation.lastMessageBody}
          fromReader={conversation.lastMessageSide === "customer"}
          at={conversation.lastMessageAt}
          unread={conversation.unread}
          active={conversation.id === selected}
          locale={locale}
          onClick={() => onSelect(conversation.id)}
        />
      ))}
    </ul>
  )
}

function ConversationRow({
  name,
  preview,
  fromReader,
  at,
  unread,
  active,
  locale,
  onClick,
}: {
  name: string
  preview: string | null
  /** The last message came from the reader's side. */
  fromReader: boolean
  at: Date | null
  unread: boolean
  active: boolean
  locale: string
  onClick: () => void
}) {
  const t = useTranslations("Inbox")

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/60",
          active && "bg-muted hover:bg-muted"
        )}
      >
        <UserAvatar name={name} className="size-9" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "flex-1 truncate text-sm",
                unread ? "font-semibold" : "font-medium"
              )}
            >
              {name}
            </span>
            {at ? (
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  unread ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {formatRelative(at, locale)}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "flex-1 truncate text-[13px]",
                unread ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {preview
                ? fromReader
                  ? `${t("you")}: ${preview}`
                  : preview
                : t("noMessagesYet")}
            </span>
            {unread ? (
              <span
                aria-label={t("unread")}
                className="size-2 shrink-0 rounded-full bg-primary"
              />
            ) : null}
          </span>
        </span>
      </button>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5 p-2">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-2/5 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {text}
    </p>
  )
}
