"use client"

import { useQuery } from "@tanstack/react-query"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { useContentHtml } from "@/components/contracts/template-preview"
import { themeById, themeCssVars } from "@/components/editor/document-options"
import {
  getPageDimensions,
  toPageSetup,
} from "@/components/editor/page-geometry"
import { AuditTrail } from "@/components/signature/signing-panel"
import { orpc } from "@/lib/orpc"
import "@/components/editor/draft-editor.css"

/**
 * A contract laid out for printing to PDF: its pages, on the document's own
 * paper size and margins (header and footer repeated on every page),
 * signatures filled into their fields, then a signing certificate with the
 * audit trail. Marks itself `data-print-ready` once everything is drawn, for
 * the headless Chrome waiting on it.
 */
export function PrintDocument({ id, token }: { id: string; token: string }) {
  const t = useTranslations("Signing")
  const format = useFormatter()
  const { data, isError } = useQuery(
    orpc.document.printable.queryOptions({ input: { id, token }, retry: false })
  )
  const body = useContentHtml(data?.content.body)
  const header = useContentHtml(data?.content.header)
  const footer = useContentHtml(data?.content.footer)
  const [ready, setReady] = useState(false)

  // Ready once the signature images (and any others) have loaded.
  useEffect(() => {
    if (!data) return
    let cancelled = false
    const images = Array.from(document.images)
    void Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true })
              image.addEventListener("error", resolve, { once: true })
            })
      )
    ).then(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [data, body])

  if (isError) return <p>{t("notFound")}</p>
  if (!data) return null

  const dims = getPageDimensions(toPageSetup(data.content.pageSetup))
  const { top, right, bottom, left } = dims.marginCm
  const theme = themeById(data.content.themeId)
  const part = (html: string) =>
    html ? (
      <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: html }} />
    ) : null
  const dateTime = (value: Date | null) =>
    value
      ? format.dateTime(value, { dateStyle: "long", timeStyle: "medium" })
      : "—"

  return (
    <div data-print-ready={ready ? "" : undefined}>
      <style>{`
        @page { size: ${dims.widthCm}cm ${dims.heightCm}cm; margin: ${top}cm ${right}cm ${bottom}cm ${left}cm; }
        html, body { background: #fff !important; color: #1f2937; }
        .print-layout { width: 100%; border-collapse: collapse; }
        .print-layout > * > tr > td { padding: 0; border: 0; }
        .print-certificate { break-before: page; font-family: system-ui, sans-serif; font-size: 10pt; }
      `}</style>

      <div
        className="draft-page"
        style={{ ...themeCssVars(theme), padding: 0 }}
      >
        <table className="print-layout">
          {header ? (
            <thead>
              <tr>
                <td style={{ paddingBottom: "12pt" }}>{part(header)}</td>
              </tr>
            </thead>
          ) : null}
          {footer ? (
            <tfoot>
              <tr>
                <td style={{ paddingTop: "12pt" }}>{part(footer)}</td>
              </tr>
            </tfoot>
          ) : null}
          <tbody>
            <tr>
              <td>{part(body)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="print-certificate flex flex-col gap-6">
        <header className="flex flex-col gap-1 border-b pb-4">
          <h1 className="text-xl font-semibold">{t("certificate.title")}</h1>
          <p className="text-sm text-slate-600">{data.name}</p>
        </header>

        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-slate-500">{t("certificate.documentId")}</dt>
          <dd className="font-mono">{data.id}</dd>
          <dt className="text-slate-500">{t("certificate.status")}</dt>
          <dd>{t(`status.${data.signing.status}`)}</dd>
          <dt className="text-slate-500">{t("certificate.sent")}</dt>
          <dd>{dateTime(data.signing.sentAt)}</dd>
          <dt className="text-slate-500">{t("certificate.completed")}</dt>
          <dd>{dateTime(data.signing.completedAt)}</dd>
          <dt className="text-slate-500">{t("certificate.landlord")}</dt>
          <dd>{data.landlord}</dd>
          <dt className="text-slate-500">{t("certificate.customer")}</dt>
          <dd>
            {data.customer.name} · {data.customer.email}
          </dd>
          {data.property ? (
            <>
              <dt className="text-slate-500">{t("certificate.property")}</dt>
              <dd>{data.property}</dd>
            </>
          ) : null}
          <dt className="text-slate-500">{t("certificate.hash")}</dt>
          <dd className="font-mono text-xs break-all">
            {data.signing.contentHash}
          </dd>
        </dl>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("certificate.signers")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {data.signing.signatures.map((signature) => (
              <li key={signature.role} className="rounded border p-3">
                <p className="font-medium">
                  {t(`party.${signature.role}`)}: {signature.name}
                </p>
                <p className="text-xs text-slate-600">
                  {[
                    signature.email,
                    dateTime(signature.signedAt),
                    signature.ip && t("ip", { ip: signature.ip }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {signature.userAgent ? (
                  <p className="text-xs break-all text-slate-500">
                    {signature.userAgent}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("auditTitle")}</h2>
          <AuditTrail signing={data.signing} />
        </div>

        <p className="text-xs text-slate-500">{t("certificate.note")}</p>
      </section>
    </div>
  )
}
