"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/ui/button"
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
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useUpdateProfile } from "@/hooks/queries/user"

type ProfileValues = { name: string }

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("AccountProfile")
  const tCommon = useTranslations("Common")
  const tValidation = useTranslations("Validation")
  const updateProfile = useUpdateProfile()

  const profileSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, tValidation("nameRequired"))
          .max(64, tValidation("nameTooLong")),
      }),
    [tValidation]
  )

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    // Re-seeds the field when the server re-renders with the saved name.
    values: { name },
  })
  const { errors, isDirty } = form.formState

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => updateProfile.mutate(values))}
      className="flex flex-col gap-5"
    >
      <Field>
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby="name-error"
          {...form.register("name")}
        />
        <FieldError id="name-error">{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" value={email} disabled readOnly />
        <FieldDescription>{t("emailDescription")}</FieldDescription>
      </Field>

      <Button
        type="submit"
        className="self-start"
        disabled={!isDirty || updateProfile.isPending}
      >
        {updateProfile.isPending ? <Loader2 className="animate-spin" /> : null}
        {tCommon("saveChanges")}
      </Button>
    </form>
  )
}
