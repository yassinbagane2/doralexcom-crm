"use client"

import { SIGNATURE_LIMITS } from "@workspace/api/contract"
import { Button } from "@workspace/ui/components/ui/button"
import { Field } from "@workspace/ui/components/ui/field"
import { Input } from "@workspace/ui/components/ui/input"
import { Label } from "@workspace/ui/components/ui/label"
import { Loader2, Pencil, Signature, Trash } from "@workspace/ui/icons"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"

import { SignaturePad } from "@/components/signature/signature-pad"
import {
  useBusinessSignature,
  useRemoveBusinessSignature,
  useSaveBusinessSignature,
} from "@/hooks/queries/signature"

/**
 * The signature every contract the business sends for signature is signed
 * with: drawn, typed or uploaded once, by the owner. Shown as it will appear
 * on contracts, with the name printed beneath it.
 */
export function SignatureSettings({
  isOwner,
  defaultSignerName,
}: {
  isOwner: boolean
  /** Who signs, until the owner says otherwise: themselves. */
  defaultSignerName: string
}) {
  const t = useTranslations("SignatureSettings")
  const format = useFormatter()
  const { data: saved, isPending } = useBusinessSignature()
  const save = useSaveBusinessSignature()
  const remove = useRemoveBusinessSignature()
  const [editing, setEditing] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [name, setName] = useState("")

  if (isPending) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />
  }

  const startEditing = () => {
    setName(saved?.signerName ?? defaultSignerName)
    setImage(null)
    setEditing(true)
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4 rounded-xl bg-muted/40 p-5">
        {saved ? (
          <>
            <div className="flex flex-col items-center gap-1 rounded-lg border bg-white px-6 py-5">
              {/* oxlint-disable-next-line nextjs/no-img-element -- a data URL, nothing to optimize */}
              <img
                src={saved.image}
                alt={t("imageAlt", { name: saved.signerName })}
                className="max-h-24 max-w-full object-contain"
              />
              <span className="w-full max-w-64 border-t border-slate-300 pt-1 text-center text-xs text-slate-600">
                {saved.signerName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("updated", {
                date: format.dateTime(saved.updatedAt, { dateStyle: "medium" }),
              })}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-background text-muted-foreground">
              <Signature className="size-5" />
            </span>
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isOwner ? t("emptyOwner") : t("emptyCollaborator")}
            </p>
          </div>
        )}

        {isOwner ? (
          <div className="flex flex-wrap justify-end gap-2">
            {saved ? (
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate({})}
              >
                <Trash size={16} />
                {t("remove")}
              </Button>
            ) : null}
            <Button onClick={startEditing}>
              {saved ? <Pencil className="size-4" /> : null}
              {saved ? t("change") : t("create")}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-xl bg-muted/40 p-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!image || !name.trim()) return
        save.mutate(
          { image, signerName: name.trim() },
          { onSuccess: () => setEditing(false) }
        )
      }}
    >
      <Field>
        <Label htmlFor="signer-name">{t("signerName")}</Label>
        <Input
          id="signer-name"
          value={name}
          maxLength={SIGNATURE_LIMITS.name}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("signerNameHint")}</p>
      </Field>

      <SignaturePad defaultName={name} onChange={setImage} />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing(false)}
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={!image || !name.trim() || save.isPending}
        >
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("save")}
        </Button>
      </div>
    </form>
  )
}
