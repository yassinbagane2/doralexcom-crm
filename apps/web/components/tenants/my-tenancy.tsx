"use client"

import { leaseStatus, localToday } from "@workspace/api/lease"
import { KeyRound, LoaderCircle, MapPin, Phone } from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"

import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import { LeaseBadge } from "@/components/tenants/tenant-list"
import { useMyTenancy } from "@/hooks/queries/tenant"
import { formatDate, formatMoney } from "@/lib/format"

/**
 * What a tenant sees when they sign in: the places they rent and the notes
 * their landlord chose to share. Nothing private reaches this page.
 */
export function MyTenancy() {
  const t = useTranslations("Tenancy")
  const locale = useLocale()
  const { data, isPending } = useMyTenancy()
  const today = localToday()

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // One landlord per tenant account; nothing to show until a lease or a
  // shared note exists.
  const records =
    data && (data.leases.length > 0 || data.notes.length > 0)
      ? [{ id: "mine", ...data }]
      : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        records.map((record) => (
          <div key={record.id} className="flex flex-col gap-6">
            {record.landlord ? (
              <h2 className="text-sm font-medium">
                {t("landlord", { name: record.landlord })}
              </h2>
            ) : null}

            <section className="flex flex-col gap-3">
              {[...record.leases]
                // Moved-out places last.
                .sort(
                  (a, b) =>
                    Number(leaseStatus(a, today) === "ended") -
                    Number(leaseStatus(b, today) === "ended")
                )
                .map((lease) => (
                  <article
                    key={lease.id}
                    className="flex flex-col gap-3 rounded-lg border p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <PropertyTypeIcon type={lease.property.type} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {lease.property.name}
                          </span>
                          <LeaseBadge lease={lease} today={today} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t("rent", {
                            amount: formatMoney(
                              lease.rent,
                              lease.currency,
                              locale
                            ),
                          })}
                          {lease.endDate
                            ? ` · ${t("until", { date: formatDate(lease.endDate, locale) })}`
                            : ""}
                        </span>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-1.5 text-sm">
                      <li className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        {lease.property.address}
                      </li>
                      {lease.property.doorCode ? (
                        <li className="flex items-center gap-2">
                          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                          {t("doorCode")}:{" "}
                          <span className="font-mono">
                            {lease.property.doorCode}
                          </span>
                        </li>
                      ) : null}
                      {lease.property.phone ? (
                        <li className="flex items-center gap-2">
                          <Phone className="size-4 shrink-0 text-muted-foreground" />
                          <a
                            href={`tel:${lease.property.phone}`}
                            className="hover:underline"
                          >
                            {lease.property.phone}
                          </a>
                        </li>
                      ) : null}
                    </ul>
                  </article>
                ))}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">{t("notesTitle")}</h2>
              {record.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("notesEmpty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {record.notes.map((note) => (
                    <li
                      key={note.id}
                      className="flex flex-col gap-1 rounded-lg border px-3 py-2.5"
                    >
                      <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(note.createdAt, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ))
      )}
    </div>
  )
}
