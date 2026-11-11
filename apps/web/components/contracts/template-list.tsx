"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import { toast } from "@workspace/ui/components/motion/toaster"
import {
  Copy,
  DotsHorizontal,
  Loader2,
  Pencil,
  Plus,
  Trash,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useRef, useState } from "react"

import {
  countMergeFields,
  TemplatePreview,
} from "@/components/contracts/template-preview"
import { routes } from "@/config/routes"
import {
  useContractTemplatePreview,
  useContractTemplates,
  useCreateContractTemplate,
  useDeleteContractTemplate,
  type ContractTemplateSummary,
} from "@/hooks/queries/contract"
import { useOnVisible } from "@/hooks/use-on-visible"
import { formatRelative } from "@/lib/format"
import { orpc } from "@/lib/orpc"

/** One card per column: 1, 2, 3 then 4 across. */
const CARD_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

const SKELETON_CARDS = 3

/** The contract templates a business has written, as cards. */
export function TemplateList() {
  const t = useTranslations("Contracts")
  const { data: templates, isPending } = useContractTemplates()
  const [deleting, setDeleting] = useState<ContractTemplateSummary | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-[-0.02em]">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className={CARD_GRID}>
        <CreateTemplateCard />
        {isPending
          ? Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <TemplateCardSkeleton key={index} />
            ))
          : templates?.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onDelete={() => setDeleting(template)}
              />
            ))}
      </div>

      <DeleteTemplateDialog
        template={deleting}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

/** Opens a blank template. Stretches to the height of the cards beside it. */
function CreateTemplateCard() {
  const t = useTranslations("Contracts")
  return (
    <Link
      href={`${routes.templates}/new`}
      className="flex min-h-48 w-full flex-col justify-center gap-y-8 rounded-xl border border-dashed p-3 text-left transition-all outline-none hover:border-primary/30 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Plus size={16} />
      </span>
      <span className="flex flex-col gap-y-1">
        <span className="text-sm font-semibold text-foreground">
          {t("createTitle")}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {t("createDescription")}
        </span>
      </span>
    </Link>
  )
}

/**
 * Header (field count and menu), one-line name, the first page, then when it
 * last changed. The name's ::after is stretched over the card, so a click
 * anywhere opens it, while the menu sits above it (z-10).
 */
function TemplateCard({
  template,
  onDelete,
}: {
  template: ContractTemplateSummary
  onDelete: () => void
}) {
  const t = useTranslations("Contracts")
  const locale = useLocale()
  const href = `${routes.templates}/${template.id}`
  const duplicate = useDuplicateTemplate()

  // The content (for the preview and field count) loads once the card is seen.
  const ref = useRef<HTMLElement>(null)
  const [seen, setSeen] = useState(false)
  useOnVisible(ref, () => setSeen(true), !seen)
  const { data } = useContractTemplatePreview(template, seen)
  const fieldCount = data ? countMergeFields(data.content) : null

  const ago = formatRelative(template.updatedAt, locale)

  return (
    <article
      ref={ref}
      className={cn(
        "group relative flex w-full flex-col rounded-xl border bg-muted/40 p-3 transition-all duration-200 focus-within:bg-card focus-within:shadow-lg hover:-translate-y-0.5 hover:bg-card hover:shadow-lg",
        duplicate.isPending && "bg-card shadow-lg"
      )}
    >
      <div className="flex h-6 items-center justify-between gap-2">
        {fieldCount === null ? (
          <span />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            <span className="text-foreground/80">{t("fields")}</span>
            <span className="font-bold tabular-nums">
              {String(fieldCount).padStart(2, "0")}
            </span>
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("actionsLabel", { name: template.name })}
                className="relative z-10 -mr-1.5 size-7 text-muted-foreground hover:text-foreground"
              />
            }
          >
            {duplicate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DotsHorizontal size={18} />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem render={<Link href={href} />}>
              <Pencil className="size-4" />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={duplicate.isPending}
              onClick={() => duplicate.run(template)}
            >
              <Copy className="size-4" />
              {t("duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash size={16} />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3
        className="mt-2 text-sm font-semibold text-foreground"
        title={template.name}
      >
        <Link
          href={href}
          className="block w-full truncate outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {template.name}
        </Link>
      </h3>

      <div className="mt-2">
        <TemplatePreview content={data?.content} />
      </div>

      <p className="mt-3 flex h-7 items-center truncate text-xs text-muted-foreground">
        {ago ? t("editedAgo", { time: ago }) : t("editedJustNow")}
      </p>
    </article>
  )
}

function TemplateCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full flex-col rounded-xl border bg-muted/40 p-3"
    >
      <div className="flex h-6 items-center">
        <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mt-2 flex h-5 items-center">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-2 aspect-video w-full animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 flex h-7 items-center">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

/** A copy of a template, content and all, named "… (copy)". */
function useDuplicateTemplate() {
  const t = useTranslations("Contracts")
  const queryClient = useQueryClient()
  const create = useCreateContractTemplate()
  const [loading, setLoading] = useState(false)

  return {
    isPending: loading || create.isPending,
    run: async (template: ContractTemplateSummary) => {
      setLoading(true)
      try {
        const source = await queryClient.fetchQuery(
          orpc.contract.getTemplate.queryOptions({
            input: { id: template.id },
          })
        )
        await create.mutateAsync({
          name: t("copyName", { name: template.name }).slice(0, 200),
          content: source.content,
        })
        toast.success(t("duplicated"))
      } catch {
        // The request's own error toast says what went wrong.
      } finally {
        setLoading(false)
      }
    },
  }
}

function DeleteTemplateDialog({
  template,
  onClose,
}: {
  template: ContractTemplateSummary | null
  onClose: () => void
}) {
  const t = useTranslations("Contracts")
  const tc = useTranslations("Common")
  const remove = useDeleteContractTemplate()
  // Kept while the dialog animates closed.
  const [shown, setShown] = useState(template)
  if (template && template !== shown) setShown(template)

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("deleteTitle", { name: shown?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("deleteDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 flex-row justify-end">
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending || !template}
            onClick={() =>
              template &&
              remove.mutate({ id: template.id }, { onSuccess: onClose })
            }
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("deleteSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
