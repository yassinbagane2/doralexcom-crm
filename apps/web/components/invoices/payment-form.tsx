"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  PAYMENT_PROOF_FILE_TYPES,
  PAYMENT_PROOF_LIMITS,
  isPaymentProofFileType,
} from "@workspace/api/invoice"
import { CUSTOMER_LIMITS, localToday } from "@workspace/api/lease"
import { Button } from "@workspace/ui/components/ui/button"
import { DialogFooter } from "@workspace/ui/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { Loader2 } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { useAmount } from "@/hooks/use-amount"

export interface PaymentFormValues {
  amount: number
  paidOn: string
  note: string
  proof?: File
}

/**
 * What a payment says: how much, when, a note, and the file proving it. The
 * business records payments with it (proof optional), and customers send
 * proof of what they paid (proof required). Sits inside a dialog.
 */
export function PaymentForm({
  id,
  remaining,
  currency,
  proof,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  /** Prefix for the fields' ids: unique on the page. */
  id: string
  /** What is left to pay: the default amount, and the most it can be. */
  remaining: number
  currency: string
  proof: "optional" | "required"
  submitLabel: string
  pending: boolean
  onSubmit: (values: PaymentFormValues) => void
  onCancel: () => void
}) {
  const t = useTranslations("Leases")
  const tc = useTranslations("Common")
  const tv = useTranslations("Leases.validation")
  const amount = useAmount()

  const schema = useMemo(
    () =>
      z.object({
        amount: amount({ required: true, max: remaining }),
        paidOn: z.iso.date(tv("dateRequired")),
        note: z.string().trim().max(CUSTOMER_LIMITS.paymentNote),
        proof: z
          .instanceof(File)
          .optional()
          .refine((file) => proof === "optional" || file, tv("proofRequired"))
          .refine(
            (file) =>
              !file ||
              (isPaymentProofFileType(file.type) &&
                file.size > 0 &&
                file.size <= PAYMENT_PROOF_LIMITS.fileBytes),
            tv("proofInvalid")
          ),
      }),
    [amount, tv, remaining, proof]
  )

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: remaining > 0 ? String(remaining) : "",
      paidOn: localToday(),
      note: "",
      proof: undefined,
    },
  })
  const { errors } = form.formState
  const optional = (
    <span className="font-normal text-muted-foreground">
      ({tc("optional").toLowerCase()})
    </span>
  )

  return (
    <form
      noValidate
      className="mt-5 flex flex-col gap-5"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${id}-amount`}>
            {t("fields.amount", { currency })}
          </Label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={Boolean(errors.amount)}
            {...form.register("amount")}
          />
          <FieldError>{errors.amount?.message}</FieldError>
        </Field>
        <Field>
          <Label htmlFor={`${id}-date`}>{t("fields.paidOn")}</Label>
          <Input
            id={`${id}-date`}
            type="date"
            max={localToday()}
            aria-invalid={Boolean(errors.paidOn)}
            {...form.register("paidOn")}
          />
          <FieldError>{errors.paidOn?.message}</FieldError>
        </Field>
      </div>
      <Field>
        <Label htmlFor={`${id}-note`}>
          {t("fields.note")} {optional}
        </Label>
        <Input
          id={`${id}-note`}
          autoComplete="off"
          placeholder={t("notePlaceholder")}
          {...form.register("note")}
        />
      </Field>
      <Field>
        <Label htmlFor={`${id}-proof`}>
          {t("fields.proof")} {proof === "optional" ? optional : null}
        </Label>
        <Controller
          control={form.control}
          name="proof"
          render={({ field }) => (
            <Input
              id={`${id}-proof`}
              type="file"
              accept={PAYMENT_PROOF_FILE_TYPES.join(",")}
              aria-invalid={Boolean(errors.proof)}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.files?.[0])}
            />
          )}
        />
        <FieldDescription>{t("proofHint")}</FieldDescription>
        <FieldError>{errors.proof?.message}</FieldError>
      </Field>
      <DialogFooter className="flex-row justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
