"use client"

import { Button } from "@workspace/ui/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/ui/sheet"
import { Plus } from "@workspace/ui/icons"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { CreateAccountForm } from "@/components/users/create-account-form"
import { routes } from "@/config/routes"
import { useCreateBusiness } from "@/hooks/queries/admin"

/**
 * Admins only create businesses. Each business then signs in, sets up its
 * organization, and creates its own users from there.
 */
export function CreateBusinessSheet() {
  const t = useTranslations("AdminUsers")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const createBusiness = useCreateBusiness()

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) createBusiness.reset()
      }}
    >
      <SheetTrigger
        render={
          <Button
            size="icon-sm"
            className="rounded-full"
            aria-label={t("create")}
          />
        }
      >
        <Plus size={16} />
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("createTitle")}</SheetTitle>
          <SheetDescription>{t("createDescription")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <CreateAccountForm
            submitLabel={t("createSubmit")}
            isPending={createBusiness.isPending}
            onSubmit={(values) =>
              createBusiness.mutate(values, {
                onSuccess: (user) => {
                  setOpen(false)
                  router.push(`${routes.adminUsers}/${user.id}`)
                },
              })
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
