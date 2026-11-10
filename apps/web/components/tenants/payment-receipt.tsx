"use client"

import { formatIban } from "@workspace/auth/organization"
import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import { ArrowLeftIcon, Info, Printer } from "@workspace/ui/icons"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { routes } from "@/config/routes"
import { usePaymentReceipt } from "@/hooks/queries/settings"
import { formatMoney } from "@/lib/format"

/** A calendar day ("2026-11-10") as a long date, without timezone drift. */
function longDate(day: string, locale: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(year!, month! - 1, date!)
  )
}

/**
 * A receipt for one rent payment, laid out for printing: the landlord with
 * the details from its settings, the tenant, what was paid and when.
 */
export function PaymentReceipt({
  tenantId,
  paymentId,
  isOwner,
}: {
  tenantId: string
  paymentId: string
  isOwner: boolean
}) {
  const t = useTranslations("Receipt")
  const to = useTranslations("Organization")
  const locale = useLocale()
  const { data: receipt, isPending, isError } = usePaymentReceipt(paymentId)
  const back = `${routes.tenants}/${tenantId}`

  if (isPending) {
    return (
      <div className="mx-auto h-[32rem] w-full max-w-2xl animate-pulse rounded-lg bg-muted" />
    )
  }
  if (isError || !receipt) {
    return (
      <Button
        variant="ghost"
        render={<Link href={back} />}
        className="self-start"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Button>
    )
  }

  const { landlord } = receipt
  const missingDetails = !landlord.iban || !landlord.taxId
  const identifiers = [
    landlord.taxId && `${t("taxId")}: ${landlord.taxId}`,
    landlord.registrationNumber &&
      `${t("registrationNumber")}: ${landlord.registrationNumber}`,
    landlord.vatNumber && `${t("vatNumber")}: ${landlord.vatNumber}`,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" render={<Link href={back} />}>
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          {t("print")}
        </Button>
      </div>

      {missingDetails ? (
        <Alert role="status" className="print:hidden">
          <Info />
          <span>
            {isOwner
              ? t.rich("missingDetails", {
                  link: (chunks) => (
                    <Link
                      href={routes.accountOrganization}
                      className="font-medium underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })
              : t("missingDetailsCollaborator")}
          </span>
        </Alert>
      ) : null}

      <article className="flex flex-col gap-8 rounded-lg border bg-card p-8 text-sm print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("issuedBy")}
            </span>
            <span className="text-base font-semibold">{landlord.name}</span>
            {landlord.legalStructure ? (
              <span className="text-muted-foreground">
                {to(`legalStructures.${landlord.legalStructure}`)}
              </span>
            ) : null}
            {landlord.address ? <span>{landlord.address}</span> : null}
            {identifiers.length > 0 ? (
              <span className="text-muted-foreground">
                {identifiers.join(" · ")}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
              {t("title")}
            </h1>
            <span className="font-mono text-muted-foreground">
              {t("number", { number: receipt.number })}
            </span>
          </div>
        </header>

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">
              {t("receivedFrom")}
            </dt>
            <dd className="flex flex-col">
              <span className="font-medium">{receipt.tenant.name}</span>
              {receipt.tenant.address ? (
                <span>{receipt.tenant.address}</span>
              ) : null}
              <span className="text-muted-foreground">
                {receipt.tenant.email}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">
              {t("forProperty")}
            </dt>
            <dd className="flex flex-col">
              <span className="font-medium">
                {t("rentFor", { property: receipt.property.name })}
              </span>
              <span>{receipt.property.address}</span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("paidOn")}</dt>
            <dd>{longDate(receipt.paidOn, locale)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("amount")}</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {formatMoney(receipt.amount, receipt.currency, locale)}
            </dd>
          </div>
          {receipt.note ? (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("note")}</dt>
              <dd>{receipt.note}</dd>
            </div>
          ) : null}
        </dl>

        <footer className="flex items-end justify-between gap-6 border-t pt-6">
          {landlord.iban || landlord.bankName ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t("payTo")}
              </span>
              {landlord.bankName ? (
                <span>
                  {t("bank")}: {landlord.bankName}
                </span>
              ) : null}
              {landlord.iban ? (
                <span className="font-mono">
                  {t("iban")}: {formatIban(landlord.iban)}
                </span>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <div className="flex w-48 flex-col items-center gap-1">
            <span className="h-12 w-full border-b" />
            <span className="text-xs text-muted-foreground">
              {t("signature")}
              {landlord.representative ? ` · ${landlord.representative}` : ""}
            </span>
          </div>
        </footer>
      </article>
    </div>
  )
}
