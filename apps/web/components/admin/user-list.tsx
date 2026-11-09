"use client"

import { getUserRole } from "@workspace/auth/roles"
import { Button } from "@workspace/ui/components/ui/button"
import { Input } from "@workspace/ui/components/ui/input"
import {
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  SearchIcon,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useDeferredValue, useState } from "react"

import { CreateBusinessSheet } from "@/components/admin/create-business-sheet"
import { RoleBadge } from "@/components/admin/role-badge"
import { routes } from "@/config/routes"
import { useAdminUsers, type RoleFilter } from "@/hooks/queries/admin"

const FILTERS: RoleFilter[] = ["all", "business", "user", "admin"]

/** The left pane of the users page: search, filter, sort, and create. */
export function UserList() {
  const t = useTranslations("AdminUsers")
  const { userId: selectedId } = useParams<{ userId?: string }>()
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<RoleFilter>("all")
  const [sort, setSort] = useState<"asc" | "desc">("desc")
  // Typing stays responsive; the list catches up between keystrokes.
  const deferredSearch = useDeferredValue(search.trim())

  const { data, isPending, isFetching } = useAdminUsers({
    search: deferredSearch,
    role,
    sort,
  })

  return (
    <div className="flex h-full flex-col divide-y">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {t("title")}
          {data ? (
            <span className="text-muted-foreground">{data.total}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={sort === "desc" ? t("sortOldest") : t("sortNewest")}
            onClick={() => setSort(sort === "desc" ? "asc" : "desc")}
          >
            {sort === "desc" ? <ArrowDown /> : <ArrowUp />}
          </Button>
          <CreateBusinessSheet />
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {isFetching && !isPending ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <div
          role="radiogroup"
          aria-label={t("filterLabel")}
          className="flex gap-1"
        >
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={role === value}
              onClick={() => setRole(value)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                role === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t(`filters.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isPending ? (
          <div className="flex justify-center py-8">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.users.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {data.users.map((user) => (
              <li key={user.id}>
                <Link
                  href={`${routes.adminUsers}/${user.id}`}
                  aria-current={selectedId === user.id ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted",
                    selectedId === user.id && "bg-muted"
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <RoleBadge role={getUserRole(user.role)} />
                    {user.banned ? (
                      <span className="text-[11px] font-medium text-destructive">
                        {t("suspended")}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </p>
        )}
      </div>
    </div>
  )
}
