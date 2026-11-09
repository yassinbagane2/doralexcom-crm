"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/ui/sheet"
import { LoaderCircle } from "@workspace/ui/icons"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  EMPTY_TENANT,
  TenantForm,
  toTenantFormValues,
} from "@/components/tenants/tenant-form"
import { routes } from "@/config/routes"
import { useCreateTenant, useUpdateTenant } from "@/hooks/queries/tenant"
import { orpc } from "@/lib/orpc"

export type TenantEditor =
  | { mode: "create" }
  | { mode: "edit"; tenantId: string }
  | { mode: "copy"; tenantId: string }

/**
 * Adds a tenant, edits one, or starts a new one from a copy of another. A
 * new tenant opens on its own page, ready for its leases.
 */
export function TenantSheet({
  editor,
  onClose,
}: {
  editor: TenantEditor | null
  onClose: () => void
}) {
  const t = useTranslations("Tenants")
  const router = useRouter()
  const create = useCreateTenant()
  const update = useUpdateTenant()
  // Keep showing the last editor while the sheet animates closed.
  const [shown, setShown] = useState(editor)
  if (editor && editor !== shown) setShown(editor)

  const mode = shown?.mode ?? "create"
  const sourceId = shown && shown.mode !== "create" ? shown.tenantId : null
  const { data: source } = useQuery({
    ...orpc.tenant.get.queryOptions({ input: { id: sourceId ?? "" } }),
    enabled: sourceId !== null,
  })
  const ready = !sourceId || source?.id === sourceId

  const defaultValues =
    !source || !sourceId
      ? EMPTY_TENANT
      : mode === "copy"
        ? {
            ...toTenantFormValues(source, { copy: true }),
            name: t("copyName", { name: source.name }),
          }
        : toTenantFormValues(source)

  return (
    <Sheet
      open={editor !== null}
      onOpenChange={(open) => {
        if (open) return
        onClose()
        create.reset()
        update.reset()
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t(`sheet.${mode}.title`)}</SheetTitle>
          <SheetDescription>
            {source && sourceId
              ? t(`sheet.${mode}.description`, { name: source.name })
              : t("sheet.create.description")}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {ready ? (
            <TenantForm
              // A fresh form for each tenant, so the last one's values never leak in.
              key={`${mode}-${sourceId ?? "new"}`}
              defaultValues={defaultValues}
              isNew={mode !== "edit"}
              submitLabel={t(`sheet.${mode}.submit`)}
              isPending={create.isPending || update.isPending}
              onSubmit={({ email, password, ...details }) => {
                if (mode === "edit" && sourceId) {
                  update.mutate(
                    { ...details, id: sourceId },
                    { onSuccess: onClose }
                  )
                } else {
                  create.mutate(
                    { ...details, email, password },
                    {
                      onSuccess: ({ id }) => {
                        onClose()
                        router.push(`${routes.tenants}/${id}`)
                      },
                    }
                  )
                }
              }}
            />
          ) : (
            <div className="flex justify-center py-10">
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
