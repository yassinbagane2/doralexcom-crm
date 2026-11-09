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
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useUpdateProfile } from "@/hooks/queries/user"

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(64, "Name is too long"),
})

type ProfileValues = z.infer<typeof profileSchema>

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const updateProfile = useUpdateProfile()

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
        <Label htmlFor="name">Name</Label>
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
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled readOnly />
        <FieldDescription>
          Your email is your sign-in name and can&apos;t be changed here.
        </FieldDescription>
      </Field>

      <Button
        type="submit"
        className="self-start"
        disabled={!isDirty || updateProfile.isPending}
      >
        {updateProfile.isPending ? <Loader2 className="animate-spin" /> : null}
        Save changes
      </Button>
    </form>
  )
}
