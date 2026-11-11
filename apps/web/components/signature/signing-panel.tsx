"use client"

import type { SignerRole } from "@workspace/api/contract"
import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import { CircleCheck, Clock, Fingerprint, Loader2 } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useTranslations } from "next-intl"

import { useWithdrawSignature } from "@/hooks/queries/contract"
import type { orpc } from "@/lib/orpc"

export type SigningRecord = NonNullable<
  Awaited<ReturnType<typeof orpc.document.getContract.call>>["signing"]
>

const PARTIES: SignerRole[] = ["landlord", "customer"]

export function SignatureStatusBadge({
  status,
}: {
  status: SigningRecord["status"]
}) {
  const t = useTranslations("Signing.status")
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "completed"
          ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      {t(status)}
    </Badge>
  )
}

/** Who has signed so far, and who still has to. */
export function Signers({ signing }: { signing: SigningRecord }) {
  const t = useTranslations("Signing")
  const format = useFormatter()

  return (
    <ul className="flex flex-col gap-2">
      {PARTIES.map((role) => {
        const signature = signing.signatures.find((s) => s.role === role)
        return (
          <li key={role} className="flex items-start gap-2.5 text-sm">
            {signature ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{t(`party.${role}`)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {signature
                  ? t("signedBy", {
                      name: signature.name,
                      date: format.dateTime(signature.signedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })
                  : t("waiting")}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The audit trail of a contract sent for signature, as DocuSeal keeps one:
 * every step, who took it, when, and from which address and browser.
 */
export function AuditTrail({
  signing,
  compact = false,
}: {
  signing: SigningRecord
  /** Leaves out addresses and browsers, for narrow places. */
  compact?: boolean
}) {
  const t = useTranslations("Signing")
  const format = useFormatter()

  return (
    <ol className="flex flex-col gap-3 border-l pl-4">
      {signing.events.map((event) => (
        <li key={event.id} className="relative flex flex-col gap-0.5 text-xs">
          <span className="absolute top-1 -left-[1.3rem] size-2 rounded-full bg-muted-foreground/40 ring-2 ring-background" />
          <span className="font-medium text-foreground">
            {t(`events.${event.type}`, {
              name: event.name ?? t(`party.${event.role ?? "landlord"}`),
            })}
          </span>
          <span className="text-muted-foreground">
            {format.dateTime(event.at, {
              dateStyle: "medium",
              timeStyle: "medium",
            })}
            {event.email ? ` · ${event.email}` : ""}
          </span>
          {!compact && (event.ip || event.userAgent) ? (
            <span className="break-all text-muted-foreground/80">
              {[event.ip && t("ip", { ip: event.ip }), event.userAgent]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

/** The document's fingerprint: proof the content signed is what was sent. */
export function ContentHash({ signing }: { signing: SigningRecord }) {
  const t = useTranslations("Signing")
  if (!signing.contentHash) return null
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <Fingerprint className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">
        {t("contentHash")}
        <span className="block font-mono break-all text-foreground/80">
          {signing.contentHash}
        </span>
      </span>
    </div>
  )
}

/**
 * Where a contract sent for signature stands, for the business: who signed,
 * the audit trail, and taking it back while the customer hasn't signed.
 */
export function SigningPanel({
  id,
  signing,
}: {
  id: string
  signing: SigningRecord
}) {
  const t = useTranslations("Signing")
  const withdraw = useWithdrawSignature()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("panelTitle")}</h2>
        <SignatureStatusBadge status={signing.status} />
      </div>
      <Signers signing={signing} />
      {signing.status === "pending" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={withdraw.isPending}
          onClick={() => withdraw.mutate({ id })}
        >
          {withdraw.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("withdraw")}
        </Button>
      ) : null}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-medium text-muted-foreground">
          {t("auditTitle")}
        </h3>
        <AuditTrail signing={signing} compact />
      </div>
      <ContentHash signing={signing} />
    </div>
  )
}
