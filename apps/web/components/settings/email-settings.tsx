"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  EMAIL_PROVIDERS,
  EMAIL_SETTINGS_LIMITS,
  SMTP_DEFAULT_PORT,
  type EmailProvider,
} from "@workspace/api/settings"
import { Alert } from "@workspace/ui/components/ui/alert"
import { Button } from "@workspace/ui/components/ui/button"
import { Checkbox } from "@workspace/ui/components/ui/checkbox"
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
import { PasswordInput } from "@workspace/ui/components/ui/password-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select"
import {
  AlertCircle,
  Check,
  Loader2,
  Mail,
  SendIcon,
} from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
  Controller,
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form"
import { z } from "zod"

import {
  useEmailSettings,
  useRemoveEmailSettings,
  useSaveEmailSettings,
  useSendTestEmail,
} from "@/hooks/queries/settings"
import type { client } from "@/lib/orpc"

type SavedSettings = NonNullable<ReturnType<typeof useEmailSettings>["data"]>
type SettingsInput = Parameters<typeof client.settings.saveEmail>[0]

/** The business's email service: where its messages are sent from. */
export function EmailSettings() {
  const { data: saved, isPending } = useEmailSettings()

  if (isPending) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" />
  }

  return (
    <div className="flex flex-col gap-6">
      <Status saved={saved ?? null} />
      <EmailSettingsForm
        // Remount after a save so the form resets to what the server stored.
        key={saved?.updatedAt.toString() ?? "none"}
        saved={saved ?? null}
      />
    </div>
  )
}

function Status({ saved }: { saved: SavedSettings | null }) {
  const t = useTranslations("EmailSettings")

  if (!saved) {
    return (
      <Alert role="status">
        <Mail size={16} />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{t("platformTitle")}</span>
          <span className="text-muted-foreground">
            {t("platformDescription")}
          </span>
        </div>
      </Alert>
    )
  }

  const from = saved.fromName
    ? `${saved.fromName} <${saved.fromEmail}>`
    : saved.fromEmail

  return (
    <Alert
      role="status"
      variant={saved.secretReadable ? "success" : "destructive"}
    >
      {saved.secretReadable ? <Check /> : <AlertCircle />}
      <span>
        {saved.secretReadable
          ? t("activeDescription", {
              provider: t(`providers.${saved.provider}`),
              from,
            })
          : t("secretUnreadable")}
      </span>
    </Alert>
  )
}

function useEmailSchema() {
  const t = useTranslations("EmailSettings.validation")

  return useMemo(() => {
    const email = z
      .string()
      .trim()
      .pipe(z.email(t("emailInvalid")).max(EMAIL_SETTINGS_LIMITS.email))
    const text = (max: number) => z.string().trim().max(max, t("tooLong"))

    return z
      .object({
        provider: z.enum(EMAIL_PROVIDERS),
        fromName: text(EMAIL_SETTINGS_LIMITS.fromName),
        fromEmail: email,
        replyTo: z.union([z.literal(""), email]),
        smtpHost: text(EMAIL_SETTINGS_LIMITS.host),
        smtpPort: z.string().trim(),
        smtpSecure: z.boolean(),
        smtpUsername: text(EMAIL_SETTINGS_LIMITS.username),
        secret: z.string().max(EMAIL_SETTINGS_LIMITS.secret, t("tooLong")),
      })
      .superRefine((values, ctx) => {
        if (values.provider !== "smtp") return
        if (!values.smtpHost) {
          ctx.addIssue({
            code: "custom",
            path: ["smtpHost"],
            message: t("hostRequired"),
          })
        }
        const port = Number(values.smtpPort)
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          ctx.addIssue({
            code: "custom",
            path: ["smtpPort"],
            message: t("portInvalid"),
          })
        }
      })
  }, [t])
}

type FormValues = z.output<ReturnType<typeof useEmailSchema>>

function toInput(values: FormValues): SettingsInput {
  const common = {
    fromName: values.fromName,
    fromEmail: values.fromEmail,
    replyTo: values.replyTo,
    secret: values.secret,
  }
  return values.provider === "smtp"
    ? {
        ...common,
        provider: "smtp",
        smtpHost: values.smtpHost,
        smtpPort: Number(values.smtpPort),
        smtpSecure: values.smtpSecure,
        smtpUsername: values.smtpUsername,
      }
    : { ...common, provider: values.provider }
}

function EmailSettingsForm({ saved }: { saved: SavedSettings | null }) {
  const t = useTranslations("EmailSettings")
  const tc = useTranslations("Common")
  const schema = useEmailSchema()
  const save = useSaveEmailSettings()
  const test = useSendTestEmail()

  const form = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: saved?.provider ?? "resend",
      fromName: saved?.fromName ?? "",
      fromEmail: saved?.fromEmail ?? "",
      replyTo: saved?.replyTo ?? "",
      smtpHost: saved?.smtpHost ?? "",
      smtpPort: String(saved?.smtpPort ?? SMTP_DEFAULT_PORT),
      smtpSecure: saved?.smtpSecure ?? false,
      smtpUsername: saved?.smtpUsername ?? "",
      secret: "",
    },
  })
  const { errors } = form.formState
  const provider = useWatch({ control: form.control, name: "provider" })

  // A saved secret is kept when the field is left blank, unless the provider
  // changed (a key means nothing to another provider) or it can't be read.
  const canKeepSecret =
    saved?.provider === provider && saved.secretReadable === true

  const providerItems = EMAIL_PROVIDERS.map((value) => ({
    value,
    label: t(`providers.${value}`),
  }))

  const testError = test.error as {
    message?: string
    data?: { detail?: string }
  } | null

  const optional = (
    <span className="font-normal text-muted-foreground">
      ({tc("optional").toLowerCase()})
    </span>
  )

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) => save.mutate(toInput(values)))}
    >
      <Field>
        <Label htmlFor="email-provider">{t("providerLabel")}</Label>
        <Controller
          control={form.control}
          name="provider"
          render={({ field }) => (
            <Select
              items={providerItems}
              value={field.value}
              onValueChange={(value) =>
                value && field.onChange(value as EmailProvider)
              }
            >
              <SelectTrigger id="email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <Label htmlFor="email-from-name">
            {t("fromNameLabel")} {optional}
          </Label>
          <Input
            id="email-from-name"
            placeholder={t("fromNamePlaceholder")}
            aria-invalid={Boolean(errors.fromName)}
            {...form.register("fromName")}
          />
          <FieldError>{errors.fromName?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor="email-from-email">{t("fromEmailLabel")}</Label>
          <Input
            id="email-from-email"
            type="email"
            placeholder="contact@example.com"
            aria-invalid={Boolean(errors.fromEmail)}
            aria-describedby="email-from-email-hint"
            {...form.register("fromEmail")}
          />
          <FieldError>{errors.fromEmail?.message}</FieldError>
          <p
            id="email-from-email-hint"
            className="text-xs text-muted-foreground"
          >
            {t("fromEmailHint")}
          </p>
        </Field>
      </div>

      <Field>
        <Label htmlFor="email-reply-to">
          {t("replyToLabel")} {optional}
        </Label>
        <Input
          id="email-reply-to"
          type="email"
          aria-invalid={Boolean(errors.replyTo)}
          {...form.register("replyTo")}
        />
        <FieldError>{errors.replyTo?.message}</FieldError>
      </Field>

      {provider === "smtp" ? (
        <>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
            <Field>
              <Label htmlFor="email-smtp-host">{t("smtpHostLabel")}</Label>
              <Input
                id="email-smtp-host"
                placeholder="smtp.example.com"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.smtpHost)}
                {...form.register("smtpHost")}
              />
              <FieldError>{errors.smtpHost?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor="email-smtp-port">{t("smtpPortLabel")}</Label>
              <Input
                id="email-smtp-port"
                inputMode="numeric"
                aria-invalid={Boolean(errors.smtpPort)}
                {...form.register("smtpPort")}
              />
              <FieldError>{errors.smtpPort?.message}</FieldError>
            </Field>
          </div>
          <Controller
            control={form.control}
            name="smtpSecure"
            render={({ field }) => (
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="email-smtp-secure"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                <Label htmlFor="email-smtp-secure" className="font-normal">
                  {t("smtpSecureLabel")}
                </Label>
              </div>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <Label htmlFor="email-smtp-username">
                {t("smtpUsernameLabel")} {optional}
              </Label>
              <Input
                id="email-smtp-username"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.smtpUsername)}
                {...form.register("smtpUsername")}
              />
              <FieldError>{errors.smtpUsername?.message}</FieldError>
            </Field>
            <SecretField
              label={t("smtpPasswordLabel")}
              canKeep={canKeepSecret}
              error={errors.secret?.message}
              registration={form.register("secret")}
            />
          </div>
        </>
      ) : (
        <SecretField
          label={
            provider === "postmark" ? t("serverTokenLabel") : t("apiKeyLabel")
          }
          canKeep={canKeepSecret}
          error={errors.secret?.message}
          registration={form.register("secret")}
        />
      )}

      {testError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <span>
            {t("testFailed", {
              detail: testError.data?.detail ?? testError.message ?? "",
            })}
          </span>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("save")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={test.isPending}
          onClick={form.handleSubmit((values) =>
            test.mutate({ settings: toInput(values) })
          )}
        >
          {test.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <SendIcon size={16} />
          )}
          {t("test")}
        </Button>
        {saved ? <RemoveDialog /> : null}
      </div>
    </form>
  )
}

function SecretField({
  label,
  canKeep,
  error,
  registration,
}: {
  label: string
  canKeep: boolean
  error?: string
  registration: UseFormRegisterReturn<"secret">
}) {
  const t = useTranslations("EmailSettings")

  return (
    <Field>
      <Label htmlFor="email-secret">{label}</Label>
      <PasswordInput
        id="email-secret"
        autoComplete="new-password"
        spellCheck={false}
        placeholder={canKeep ? "••••••••" : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby="email-secret-hint"
        {...registration}
      />
      <FieldError>{error}</FieldError>
      {canKeep ? (
        <p id="email-secret-hint" className="text-xs text-muted-foreground">
          {t("keepSecret")}
        </p>
      ) : null}
    </Field>
  )
}

function RemoveDialog() {
  const t = useTranslations("EmailSettings")
  const tc = useTranslations("Common")
  const [open, setOpen] = useState(false)
  const remove = useRemoveEmailSettings()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" size="lg" variant="ghost" />}
      >
        {t("remove")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle")}</DialogTitle>
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
