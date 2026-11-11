"use client"

import { SIGNATURE_LIMITS } from "@workspace/api/contract"
import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import {
  AlertCircle,
  ArrowLeftIcon,
  CircleCheck,
  Download,
  Loader2,
  LoaderCircle,
} from "@workspace/ui/icons"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { PdfViewer } from "@/components/documents/pdf-viewer-lazy"
import { SignaturePad } from "@/components/signature/signature-pad"
import {
  AuditTrail,
  Signers,
  SignatureStatusBadge,
} from "@/components/signature/signing-panel"
import { routes } from "@/config/routes"
import {
  usePortalDocument,
  usePortalPdf,
  useSignDocument,
} from "@/hooks/queries/portal"
import { saveFile } from "@/lib/download"

/**
 * A contract the landlord sent the customer, already signed for the business:
 * read it as the PDF kept for it, then sign, by drawing, typing or uploading a
 * signature and agreeing to sign electronically. Signing fills every customer
 * signature field and completes the contract; the PDF is written again with
 * both signatures and the audit trail.
 */
export function SignDocument({
  id,
  signerName,
}: {
  id: string
  /** The customer's name, suggested as the name they sign with. */
  signerName: string
}) {
  const t = useTranslations("Signing")
  const document = usePortalDocument(id)
  const pdf = usePortalPdf(id)

  if (document.isPending) {
    return (
      <div className="flex justify-center py-16">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (document.isError || !document.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" render={<Link href={routes.myHome} />}>
          <ArrowLeftIcon isHovered className="size-4" />
          {t("backHome")}
        </Button>
      </div>
    )
  }

  const { name, landlord, property, signing } = document.data
  const pending = signing.status === "pending"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={routes.myHome} />}
        >
          <ArrowLeftIcon isHovered className="size-4" />
          {t("backHome")}
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[t("from", { landlord }), property].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SignatureStatusBadge status={signing.status} />
          <Button
            variant="outline"
            size="sm"
            disabled={!pdf.data}
            onClick={() => pdf.data && saveFile(pdf.data, `${name}.pdf`)}
          >
            <Download className="size-3.5" />
            {t("download")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-[70vh] min-h-112 overflow-hidden rounded-xl border lg:h-[calc(100dvh-14rem)]">
          {pdf.isPending ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : pdf.isError || !pdf.data ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <AlertCircle className="size-5" />
              {t("pdfMissing")}
            </div>
          ) : (
            <PdfViewer file={pdf.data} />
          )}
        </div>

        <aside className="flex flex-col gap-5 self-start rounded-xl border p-5 lg:sticky lg:top-4">
          {pending ? (
            <SignForm id={id} defaultName={signerName} />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <CircleCheck className="size-8 text-emerald-600" />
              <p className="font-medium">{t("completedTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("completedDescription")}
              </p>
            </div>
          )}
          <Signers signing={signing} />
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {t("auditTitle")}
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <AuditTrail signing={signing} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}

function SignForm({ id, defaultName }: { id: string; defaultName: string }) {
  const t = useTranslations("Signing")
  const sign = useSignDocument()
  const [name, setName] = useState(defaultName)
  const [image, setImage] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const ready = Boolean(image && name.trim() && consent)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready || !image) return
        sign.mutate({ id, name: name.trim(), image, consent: true })
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{t("signTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("signDescription")}</p>
      </div>

      <Field>
        <Label htmlFor="sign-name">{t("fullName")}</Label>
        <Input
          id="sign-name"
          value={name}
          maxLength={SIGNATURE_LIMITS.name}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <SignaturePad defaultName={name} onChange={setImage} />

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="sign-consent"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked)}
          className="mt-0.5"
        />
        <Label
          htmlFor="sign-consent"
          className="text-xs leading-relaxed font-normal text-muted-foreground"
        >
          {t("consent")}
        </Label>
      </div>

      <Button type="submit" disabled={!ready || sign.isPending}>
        {sign.isPending ? <Loader2 className="animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  )
}
