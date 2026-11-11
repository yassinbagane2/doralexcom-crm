"use client"

import { Button } from "@workspace/ui/components/ui/button"
import { ArrowLeftIcon, LoaderCircle } from "@workspace/ui/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import {
  EMPTY_PROPERTY,
  PropertyForm,
  toFormValues,
} from "@/components/properties/property-form"
import { propertyRoute, routes } from "@/config/routes"
import {
  useCreateProperty,
  useProperty,
  useUpdateProperty,
} from "@/hooks/queries/property"

/**
 * The page for adding a property, editing one (`propertyId`), or starting a
 * new one from a copy of another (`copyFrom`).
 */
export function PropertyEditor({
  propertyId,
  copyFrom,
}: {
  propertyId?: string
  copyFrom?: string
}) {
  const t = useTranslations("Properties")
  const router = useRouter()
  const create = useCreateProperty()
  const update = useUpdateProperty()
  const sourceId = propertyId ?? copyFrom ?? null
  const source = useProperty(sourceId)
  const mode = propertyId ? "edit" : copyFrom ? "copy" : "create"
  const back = sourceId ? propertyRoute(sourceId) : routes.properties

  const backLink = (
    <Link
      href={back}
      className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon isHovered className="size-4" />
      {sourceId && source.data ? source.data.name : t("back")}
    </Link>
  )

  if (sourceId && source.isPending) {
    return (
      <div className="flex justify-center py-16">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sourceId && (source.isError || !source.data)) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Button variant="outline" render={<Link href={routes.properties} />}>
          <ArrowLeftIcon isHovered className="size-4" />
          {t("back")}
        </Button>
      </div>
    )
  }

  const property = source.data
  const defaultValues = !property
    ? EMPTY_PROPERTY
    : mode === "copy"
      ? {
          ...toFormValues(property),
          name: t("copyName", { name: property.name }),
        }
      : toFormValues(property)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {backLink}

      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          {t(`editor.${mode}.title`)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {property
            ? t(`editor.${mode}.description`, { name: property.name })
            : t("editor.create.description")}
        </p>
      </header>

      <PropertyForm
        defaultValues={defaultValues}
        submitLabel={t(`editor.${mode}.submit`)}
        isPending={create.isPending || update.isPending}
        onCancel={() => router.push(back)}
        onSubmit={(input) => {
          if (mode === "edit" && propertyId) {
            update.mutate(
              { ...input, id: propertyId },
              { onSuccess: () => router.push(propertyRoute(propertyId)) }
            )
          } else {
            create.mutate(input, {
              onSuccess: ({ id }) => router.push(propertyRoute(id)),
            })
          }
        }}
      />
    </div>
  )
}
