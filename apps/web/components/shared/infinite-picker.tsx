"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
  ComboboxValue,
} from "@workspace/ui/components/ui/combobox"
import { LoaderCircle } from "@workspace/ui/icons"
import type { ReactNode } from "react"

import {
  InfiniteScrollTrigger,
  type InfiniteScrollSource,
} from "@/components/shared/infinite-scroll-trigger"

/**
 * Picks one item from a list the server searches and pages through: the
 * search box sits in the popup, and the next page loads as the list's end
 * scrolls into view. The chosen item is kept whole, so it stays shown when a
 * later search no longer returns it.
 */
export function InfinitePicker<T extends { id: string }>({
  id,
  items,
  query,
  value,
  onValueChange,
  search,
  onSearchChange,
  itemLabel,
  renderItem,
  placeholder,
  searchPlaceholder,
  emptyText,
  invalid,
}: {
  id?: string
  items: T[]
  /** The infinite query behind `items`; `isPending` shows a spinner. */
  query: InfiniteScrollSource & { isPending: boolean }
  value: T | null
  onValueChange: (item: T) => void
  search: string
  onSearchChange: (search: string) => void
  itemLabel: (item: T) => string
  renderItem: (item: T) => ReactNode
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  invalid?: boolean
}) {
  return (
    <Combobox<T>
      items={items}
      // The server filters: show what it returned.
      filter={null}
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      inputValue={search}
      onInputValueChange={(next, details) => {
        // Only typing changes the search, not picking or closing.
        if (
          details.reason === "input-change" ||
          details.reason === "input-clear"
        ) {
          onSearchChange(next)
        }
      }}
      itemToStringLabel={itemLabel}
      isItemEqualToValue={(item, chosen) => item.id === chosen.id}
    >
      <ComboboxTrigger id={id} aria-invalid={invalid || undefined}>
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
          {value ? (
            renderItem(value)
          ) : (
            <ComboboxValue placeholder={placeholder} />
          )}
        </span>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder={searchPlaceholder} />
        {query.isPending ? (
          <div className="flex justify-center py-6">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        )}
        <ComboboxList className="max-h-64">
          {items.map((item) => (
            <ComboboxItem key={item.id} value={item}>
              {renderItem(item)}
            </ComboboxItem>
          ))}
          {query.isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          <InfiniteScrollTrigger query={query} />
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
