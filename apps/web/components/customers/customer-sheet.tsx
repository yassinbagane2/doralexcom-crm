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
  EMPTY_CUSTOMER,
  CustomerForm,
  toCustomerFormValues,
} from "@/components/customers/customer-form"
import { routes } from "@/config/routes"
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/queries/customer"
import { orpc } from "@/lib/orpc"

export type CustomerEditor =
  | { mode: "create" }
  | { mode: "edit"; customerId: string }
  | { mode: "copy"; customerId: string }

/**
 * Adds a customer, edits one, or starts a new one from a copy of another. A
 * new customer opens on its own page, ready for its leases.
 */
export function CustomerSheet({
  editor,
  onClose,
}: {
  editor: CustomerEditor | null
  onClose: () => void
}) {
  const t = useTranslations("Customers")
  const router = useRouter()
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  // Keep showing the last editor while the sheet animates closed.
  const [shown, setShown] = useState(editor)
  if (editor && editor !== shown) setShown(editor)

  const mode = shown?.mode ?? "create"
  const sourceId = shown && shown.mode !== "create" ? shown.customerId : null
  const { data: source } = useQuery({
    ...orpc.customer.get.queryOptions({ input: { id: sourceId ?? "" } }),
    enabled: sourceId !== null,
  })
  const ready = !sourceId || source?.id === sourceId

  const defaultValues =
    !source || !sourceId
      ? EMPTY_CUSTOMER
      : mode === "copy"
        ? {
            ...toCustomerFormValues(source, { copy: true }),
            name: t("copyName", { name: source.name }),
          }
        : toCustomerFormValues(source)

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
            <CustomerForm
              // A fresh form for each customer, so the last one's values never leak in.
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
                        router.push(`${routes.customers}/${id}`)
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
