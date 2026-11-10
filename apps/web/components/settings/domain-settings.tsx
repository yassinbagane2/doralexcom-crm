"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { isValidHostname, normalizeHostname } from "@workspace/api/settings"
import { Alert } from "@workspace/ui/components/ui/alert"
import { Badge } from "@workspace/ui/components/ui/badge"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/ui/dialog"
import { Field, FieldError } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
} from "@workspace/ui/icons"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  useDomainSettings,
  useRemoveDomain,
  useSetDomain,
  useVerifyDomain,
} from "@/hooks/queries/settings"
import { formatRelative } from "@/lib/format"

type DomainData = NonNullable<ReturnType<typeof useDomainSettings>["data"]>
type Domain = NonNullable<DomainData["domain"]>

/** The business's own web address: claim it, add DNS records, verify. */
export function DomainSettings() {
  const { data, isPending } = useDomainSettings()
  const [editing, setEditing] = useState(false)

  if (isPending || !data) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />
  }

  if (!data.domain || editing) {
    return (
      <HostnameForm
        current={data.domain?.hostname}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <DomainStatus
      data={data}
      domain={data.domain}
      onChange={() => setEditing(true)}
    />
  )
}

function HostnameForm({
  current,
  onDone,
}: {
  current?: string
  onDone: () => void
}) {
  const t = useTranslations("DomainSettings")
  const tc = useTranslations("Common")
  const setDomain = useSetDomain()

  const schema = useMemo(
    () =>
      z.object({
        hostname: z
          .string()
          .transform(normalizeHostname)
          .refine(isValidHostname, t("validation.invalid")),
      }),
    [t]
  )
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { hostname: current ?? "" },
  })
  const { errors } = form.formState

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((values) =>
        setDomain.mutate(values, { onSuccess: onDone })
      )}
    >
      <Field>
        <Label htmlFor="domain-hostname">{t("hostnameLabel")}</Label>
        <Input
          id="domain-hostname"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("hostnamePlaceholder")}
          aria-invalid={Boolean(errors.hostname)}
          aria-describedby="domain-hostname-error"
          {...form.register("hostname")}
        />
        <FieldError id="domain-hostname-error">
          {errors.hostname?.message}
        </FieldError>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={setDomain.isPending}>
          {setDomain.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("save")}
        </Button>
        {current ? (
          <Button type="button" size="lg" variant="ghost" onClick={onDone}>
            {tc("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function DomainStatus({
  data,
  domain,
  onChange,
}: {
  data: DomainData
  domain: Domain
  onChange: () => void
}) {
  const t = useTranslations("DomainSettings")
  const locale = useLocale()
  const verify = useVerifyDomain()
  const active = domain.status === "active"
  const url = `https://${domain.hostname}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 truncate font-mono text-sm font-medium">
          {domain.hostname}
        </span>
        <Badge variant={active ? "default" : "outline"}>
          {t(`status.${domain.status}`)}
        </Badge>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onChange}>
            {t("change")}
          </Button>
          <RemoveDialog hostname={domain.hostname} />
        </div>
      </div>

      {active ? (
        <Alert role="status" variant="success">
          <Check />
          <div className="flex flex-col gap-1">
            <span>
              {t.rich("activeDescription", {
                url,
                link: (chunks) => (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
                  >
                    {chunks}
                    <ExternalLink className="size-3" />
                  </a>
                ),
              })}
            </span>
          </div>
        </Alert>
      ) : domain.lastError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <span>
            {t(`errors.${domain.lastError}`, { target: data.target })}
          </span>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">{t("recordsTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("recordsDescription")}
          </p>
        </div>
        <RecordTable
          rows={[
            {
              step: t("ownershipStep"),
              type: "TXT",
              name: `${data.challengePrefix}.${domain.hostname}`,
              value: domain.verificationToken,
            },
            {
              step: t("routingStep"),
              type: "CNAME",
              name: domain.hostname,
              value: data.target,
            },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          {t("apexHint", { target: data.target })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={active ? "outline" : "default"}
          disabled={verify.isPending}
          onClick={() => verify.mutate(undefined)}
        >
          {verify.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t("verify")}
        </Button>
        {domain.lastCheckedAt ? (
          <span className="text-xs text-muted-foreground">
            {t("lastChecked", {
              time:
                formatRelative(domain.lastCheckedAt, locale) ??
                new Date(domain.lastCheckedAt).toLocaleTimeString(locale),
            })}
          </span>
        ) : null}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        {t("passkeyNote")}
      </p>
    </div>
  )
}

interface DnsRecord {
  step: string
  type: string
  name: string
  value: string
}

function RecordTable({ rows }: { rows: DnsRecord[] }) {
  const t = useTranslations("DomainSettings")

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li
          key={row.type}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <span className="text-xs font-medium text-muted-foreground">
            {index + 1}. {row.step}
          </span>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-xs text-muted-foreground">{t("type")}</dt>
            <dd className="font-mono">{row.type}</dd>
            <dt className="text-xs text-muted-foreground">{t("name")}</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono">{row.name}</span>
              <CopyButton value={row.name} label={t("name")} />
            </dd>
            <dt className="text-xs text-muted-foreground">{t("value")}</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono">{row.value}</span>
              <CopyButton value={row.value} label={t("value")} />
            </dd>
          </dl>
        </li>
      ))}
    </ol>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("DomainSettings")
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? t("copied") : t("copy", { label })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard blocked: the value is on screen to select by hand.
        }
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </Button>
  )
}

function RemoveDialog({ hostname }: { hostname: string }) {
  const t = useTranslations("DomainSettings")
  const tc = useTranslations("Common")
  const [open, setOpen] = useState(false)
  const remove = useRemoveDomain()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-destructive" />
        }
      >
        {t("remove")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle", { hostname })}</DialogTitle>
          <DialogDescription>{t("removeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, { onSuccess: () => setOpen(false) })
            }
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
