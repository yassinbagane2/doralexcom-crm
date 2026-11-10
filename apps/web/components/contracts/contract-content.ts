"use client"

import type { JSONContent } from "@tiptap/core"
import { formatIban } from "@workspace/auth/organization"
import {
  fillMergeFields,
  isMergeFieldKey,
  MERGE_FIELD_NODE,
  type DocumentContent,
  type MergeFieldKey,
} from "@workspace/api/contract"
import {
  leaseDays,
  leaseMonths,
  localToday,
  monthlyDue,
} from "@workspace/api/lease"
import { useLocale, useTranslations } from "next-intl"
import { useCallback } from "react"

import { DEFAULT_PAGE_SETUP } from "@/components/editor/page-geometry"
import type { ContractMergeData } from "@/hooks/queries/contract"
import { formatArea, formatMoney } from "@/lib/format"

type Doc = DocumentContent["body"]

/**
 * Text with `[lease.rent]`-style merge fields and `**bold**` runs, as the
 * starter contract's messages write them, turned into editor nodes.
 */
function inline(text: string): JSONContent[] {
  const nodes: JSONContent[] = []
  for (const part of text.split(/(\*\*[^*]+\*\*)/)) {
    if (!part) continue
    const bold = part.startsWith("**") && part.endsWith("**")
    const marks = bold ? [{ type: "bold" }] : undefined
    const pieces = (bold ? part.slice(2, -2) : part).split(
      /\[([a-zA-Z]+\.[a-zA-Z]+)\]/
    )
    pieces.forEach((piece, index) => {
      if (!piece) return
      if (index % 2 === 1 && isMergeFieldKey(piece)) {
        nodes.push({ type: MERGE_FIELD_NODE, attrs: { key: piece }, marks })
      } else {
        nodes.push({
          type: "text",
          text: index % 2 ? `[${piece}]` : piece,
          marks,
        })
      }
    })
  }
  return nodes
}

const paragraph = (text = ""): JSONContent =>
  text ? { type: "paragraph", content: inline(text) } : { type: "paragraph" }

const heading = (level: 1 | 2, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: inline(text),
})

const table = (rows: string[][], header = false): JSONContent => ({
  type: "table",
  content: rows.map((cells, index) => ({
    type: "tableRow",
    content: cells.map((cell) => ({
      type: header && index === 0 ? "tableHeader" : "tableCell",
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [paragraph(cell)],
    })),
  })),
})

/**
 * What a new template starts with: a short residential lease that shows off
 * the fields, in the reader's language. Theirs to rewrite.
 */
export function useStarterContract() {
  const t = useTranslations("StarterContract")

  return useCallback(
    (): DocumentContent => ({
      version: 1,
      body: {
        type: "doc",
        content: [
          heading(1, t("title")),
          paragraph(t("intro")),
          paragraph(t("landlord")),
          paragraph(t("tenant")),
          heading(2, t("propertyHeading")),
          paragraph(t("property")),
          heading(2, t("termHeading")),
          paragraph(t("term")),
          paragraph(t("renewal")),
          heading(2, t("paymentHeading")),
          paragraph(t("payment")),
          table([
            [t("rent"), "[lease.rent]"],
            [t("charges"), "[lease.charges]"],
            [t("additionalCosts"), "[lease.additionalCosts]"],
            [t("discount"), "[lease.discount]"],
            [t("total"), "**[lease.monthlyTotal]**"],
          ]),
          heading(2, t("depositHeading")),
          paragraph(t("deposit")),
          heading(2, t("signaturesHeading")),
          table([
            [t("landlordSignature"), t("tenantSignature")],
            ["[landlord.representative]", "[tenant.name]"],
            ["", ""],
          ]),
        ],
      } as Doc,
      header: null,
      footer: null,
      pageSetup: DEFAULT_PAGE_SETUP,
      themeId: "classic",
    }),
    [t]
  )
}

/** A calendar day as a long date in the reader's language: "9 November 2026". */
function longDate(day: string, locale: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(year!, month! - 1, date!)
  )
}

/** Every merge field's value for one lease, worded for a contract. */
export function useMergeValues() {
  const t = useTranslations("MergeFields.values")
  const tp = useTranslations("Properties")
  const to = useTranslations("Organization")
  const locale = useLocale()

  return useCallback(
    ({
      landlord,
      tenant,
      property,
      lease,
    }: ContractMergeData): Record<MergeFieldKey, string> => {
      const money = (amount: number) =>
        formatMoney(amount, lease.currency, locale)
      const months = leaseMonths(lease)
      const days = leaseDays(lease)
      const length = months
        ? t("months", { count: months })
        : days
          ? t("days", { count: days })
          : t("openEnded")

      return {
        "landlord.name": landlord.name,
        "landlord.representative": landlord.representative ?? "",
        "landlord.email": landlord.email ?? "",
        "landlord.legalStructure": landlord.legalStructure
          ? to(`legalStructures.${landlord.legalStructure}`)
          : "",
        "landlord.address": landlord.address ?? "",
        "landlord.taxId": landlord.taxId ?? "",
        "landlord.registrationNumber": landlord.registrationNumber ?? "",
        "landlord.vatNumber": landlord.vatNumber ?? "",
        "landlord.bankName": landlord.bankName ?? "",
        "landlord.iban": landlord.iban ? formatIban(landlord.iban) : "",
        "tenant.name": tenant.name,
        "tenant.email": tenant.email,
        "tenant.phone": tenant.phone ?? "",
        "tenant.address": tenant.address ?? "",
        "property.name": property.name,
        "property.type": tp(`types.${property.type}`).toLocaleLowerCase(locale),
        "property.address": property.address,
        "property.surfaceArea":
          property.surfaceArea != null
            ? formatArea(property.surfaceArea, locale)
            : "",
        "property.description": property.description ?? "",
        "lease.startDate": longDate(lease.startDate, locale),
        "lease.endDate": lease.endDate
          ? longDate(lease.endDate, locale)
          : t("noEndDate"),
        "lease.length": length,
        "lease.renewal":
          lease.autoRenew && lease.termMonths
            ? t("renews", { length: t("months", { count: lease.termMonths }) })
            : t("noRenewal"),
        "lease.rent": money(lease.rent),
        "lease.charges": money(lease.charges),
        "lease.additionalCosts": money(lease.additionalCosts),
        "lease.discount": money(lease.discount),
        "lease.monthlyTotal": money(monthlyDue(lease)),
        "lease.deposit": money(lease.deposit),
        "lease.currency": lease.currency,
        "document.date": longDate(localToday(), locale),
      }
    },
    [t, tp, to, locale]
  )
}

/** A template's content with every field replaced by its value. */
export function fillContract(
  content: DocumentContent,
  values: Record<MergeFieldKey, string>
): DocumentContent {
  return {
    ...content,
    body: fillMergeFields(content.body, values),
    header: content.header && fillMergeFields(content.header, values),
    footer: content.footer && fillMergeFields(content.footer, values),
  }
}
