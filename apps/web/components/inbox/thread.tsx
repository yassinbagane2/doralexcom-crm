"use client"

import { MESSAGE_MAX_LENGTH } from "@workspace/api/conversation"
import { Button } from "@workspace/ui/components/ui/button"
import { Textarea } from "@workspace/ui/components/ui/textarea"
import {
  ArrowUp,
  ChevronLeftIcon,
  LoaderCircle,
  MessageSquare,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"

import { UserAvatar } from "@/components/shared/user-avatar"
import {
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
  type Message,
} from "@/hooks/queries/conversation"

/**
 * One conversation: who it's with, its messages (older ones load on demand)
 * and a box to answer. Opening it, and each new message from the other side
 * while it's open, marks it read.
 */
export function Thread({
  conversationId,
  onBack,
}: {
  conversationId: string
  /** Shown on small screens, where the list and the thread take turns. */
  onBack?: () => void
}) {
  const t = useTranslations("Inbox")
  const header = useConversation(conversationId)
  const messages = useMessages(conversationId)
  const send = useSendMessage(conversationId)
  const markRead = useMarkRead()
  const scroller = useRef<HTMLDivElement>(null)

  // Newest page first; within a page, oldest first.
  const list = [...(messages.data?.pages ?? [])]
    .reverse()
    .flatMap((page) => page.messages)
  const newest = list.at(-1)

  // Read on open, and again whenever something new arrives while open.
  const { mutate: markAsRead } = markRead
  useEffect(() => {
    markAsRead(conversationId)
  }, [conversationId, newest?.id, markAsRead])

  // Follow the conversation: jump to the newest message when one arrives
  // (not when older ones load above).
  useLayoutEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [newest?.id, send.isPending])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-5">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-1 md:hidden"
            aria-label={t("back")}
            onClick={onBack}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
        ) : null}
        {header.data ? (
          <>
            <UserAvatar
              name={header.data.with.name}
              className="size-10 text-sm"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {header.data.with.name}
              </span>
              {header.data.with.email ? (
                <span className="truncate text-xs text-muted-foreground">
                  {header.data.with.email}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
          </div>
        )}
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 md:px-5"
      >
        {messages.hasNextPage ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-center rounded-full text-xs text-muted-foreground"
            disabled={messages.isFetchingNextPage}
            onClick={() => void messages.fetchNextPage()}
          >
            {messages.isFetchingNextPage ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : null}
            {t("loadOlder")}
          </Button>
        ) : null}

        {messages.isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 && !send.isPending ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <MessageSquare className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">{t("emptyThread")}</p>
          </div>
        ) : (
          <MessageList
            messages={list}
            readerSide={header.data?.side}
            counterpart={header.data?.with.name}
            pending={send.isPending ? send.variables : undefined}
          />
        )}
      </div>

      <Composer
        sending={send.isPending}
        onSend={(body, done) => send.mutate(body, { onSuccess: done })}
      />
    </div>
  )
}

function MessageList({
  messages,
  readerSide,
  counterpart,
  pending,
}: {
  messages: Message[]
  /** Which side the reader answers for. */
  readerSide?: Message["side"]
  /** Who the conversation is with: the face beside their messages. */
  counterpart?: string
  /** A message on its way, shown faded until the server has it. */
  pending?: string
}) {
  const t = useTranslations("Inbox")
  const locale = useLocale()

  // Consecutive messages from one person, on one day, read as one group.
  const sameAuthor = (a?: Message, b?: Message) =>
    !!a &&
    !!b &&
    sameDay(a.createdAt, b.createdAt) &&
    a.side === b.side &&
    a.sender?.id === b.sender?.id

  return (
    <>
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const next = messages[index + 1]
        const newDay =
          !previous || !sameDay(previous.createdAt, message.createdAt)
        const first = !sameAuthor(previous, message)
        // The pending message joins the reader's last group.
        const last = next
          ? !sameAuthor(message, next)
          : !(pending && message.mine)
        const name = message.sender?.name ?? t("deletedAccount")
        // Several people answer for a business: name them, except the
        // counterpart the header already names.
        const showAuthor =
          first &&
          !message.mine &&
          (readerSide === "customer" || message.side === readerSide)

        return (
          <Fragment key={message.id}>
            {newDay ? (
              <DaySeparator date={message.createdAt} locale={locale} />
            ) : null}
            <Bubble
              mine={message.mine}
              body={message.body}
              first={first}
              last={last}
              author={showAuthor ? name : undefined}
              avatar={
                message.side === readerSide
                  ? name
                  : (counterpart ?? message.sender?.name ?? name)
              }
              time={last ? formatTime(message.createdAt, locale) : undefined}
            />
          </Fragment>
        )
      })}
      {pending ? (
        <Bubble
          mine
          body={pending}
          first={!messages.at(-1)?.mine}
          last
          pending
        />
      ) : null}
    </>
  )
}

function Bubble({
  mine,
  body,
  first,
  last,
  author,
  avatar,
  time,
  pending,
}: {
  mine: boolean
  body: string
  /** Opens a group: more room above it. */
  first: boolean
  /** Closes a group: carries the face and the time. */
  last: boolean
  author?: string
  /** Whose face shows beside the group (others' messages only). */
  avatar?: string
  time?: string
  pending?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        mine ? "justify-end" : "justify-start",
        first ? "mt-3" : "mt-0.5"
      )}
    >
      {!mine ? (
        <span className="w-7 shrink-0">
          {last && avatar ? (
            <UserAvatar name={avatar} className="size-7 text-[10px]" />
          ) : null}
        </span>
      ) : null}
      <div
        className={cn(
          "flex max-w-[75%] min-w-0 flex-col gap-1",
          mine ? "items-end" : "items-start"
        )}
      >
        {author ? (
          <span className="px-3 text-xs text-muted-foreground">{author}</span>
        ) : null}
        <div
          className={cn(
            "rounded-[20px] px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
            mine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
            // Corners on the inner side tighten where a group continues.
            mine
              ? [!first && "rounded-tr-md", !last && "rounded-br-md"]
              : [!first && "rounded-tl-md", !last && "rounded-bl-md"],
            pending && "opacity-60"
          )}
        >
          {body}
        </div>
        {time ? (
          <span className="px-1 text-[11px] text-muted-foreground tabular-nums">
            {time}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function DaySeparator({ date, locale }: { date: Date; locale: string }) {
  const t = useTranslations("Inbox")
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const label = sameDay(date, today)
    ? t("today")
    : sameDay(date, yesterday)
      ? t("yesterday")
      : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)

  return (
    <div className="mt-5 mb-1 flex justify-center first:mt-0">
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

/** The answer box: Enter sends, Shift+Enter starts a new line. */
function Composer({
  sending,
  onSend,
}: {
  sending: boolean
  onSend: (body: string, done: () => void) => void
}) {
  const t = useTranslations("Inbox")
  const [draft, setDraft] = useState("")
  const body = draft.trim()

  function submit() {
    if (!body || sending) return
    // The draft stays until the server has the message, so a failed send
    // loses nothing.
    onSend(body, () => setDraft(""))
  }

  return (
    <form
      className="shrink-0 px-3 pt-1 pb-3 md:px-4 md:pb-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex items-end gap-2 rounded-3xl border bg-background py-1.5 pr-1.5 pl-4 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={t("draftPlaceholder")}
          aria-label={t("draftPlaceholder")}
          title={t("sendHint")}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={1}
          className="max-h-40 min-h-8 resize-none rounded-none border-none bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="size-8 shrink-0 rounded-full"
          aria-label={t("send")}
          disabled={!body || sending}
        >
          {sending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
    </form>
  )
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function formatTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date)
}
