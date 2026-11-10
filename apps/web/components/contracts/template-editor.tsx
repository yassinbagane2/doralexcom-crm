"use client"

import type { DocumentContent } from "@workspace/api/contract"
import { Button } from "@workspace/ui/components/ui/button"
import { toast } from "@workspace/ui/components/motion/toaster"
import { ArrowLeftIcon, Braces } from "@workspace/ui/icons"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useRef } from "react"

import {
  DocumentEditor,
  DocumentEditorLoading,
} from "@/components/editor/document-editor"
import { routes } from "@/config/routes"
import {
  useContractTemplate,
  useCreateContractTemplate,
  useUpdateContractTemplate,
} from "@/hooks/queries/contract"

/** Opens a saved template, or starts a new one on a blank page. */
export function TemplateEditor({ templateId }: { templateId: string | null }) {
  return templateId ? (
    <SavedTemplateEditor templateId={templateId} />
  ) : (
    <NewTemplateEditor />
  )
}

function SavedTemplateEditor({ templateId }: { templateId: string }) {
  const t = useTranslations("Contracts.editor")
  const { data, isPending, isError } = useContractTemplate(templateId)

  if (isPending) return <DocumentEditorLoading />
  if (isError || !data) return <NotFound message={t("notFound")} />

  return (
    <TemplateDocument
      templateId={data.id}
      title={data.name}
      content={data.content}
    />
  )
}

function NewTemplateEditor() {
  const t = useTranslations("Contracts.editor")
  return (
    <TemplateDocument templateId={null} title={t("newTitle")} content={null} />
  )
}

function TemplateDocument({
  templateId,
  title,
  content,
}: {
  templateId: string | null
  title: string
  /** Null starts a blank page. */
  content: DocumentContent | null
}) {
  const t = useTranslations("Contracts")
  const create = useCreateContractTemplate()
  const update = useUpdateContractTemplate()
  // Set by the first save of a new template; later saves update it.
  const savedId = useRef(templateId)

  const onSave = useCallback(
    async (name: string, next: DocumentContent) => {
      if (savedId.current) {
        await update.mutateAsync({ id: savedId.current, name, content: next })
        toast.success(t("saved"))
        return
      }
      const { id } = await create.mutateAsync({ name, content: next })
      savedId.current = id
      // The address now names the template, so a reload reopens it.
      window.history.replaceState(null, "", `${routes.templates}/${id}`)
      toast.success(t("created"))
    },
    [create, update, t]
  )

  return (
    <DocumentEditor
      title={title}
      content={content}
      onSave={onSave}
      isNew={templateId === null}
      fields
      backHref={routes.templates}
      backLabel={t("editor.back")}
      eyebrow={t("editor.eyebrow")}
      placeholder={t("editor.placeholder")}
      banner={<FieldsBanner />}
    />
  )
}

/** How a template's fields work, under the toolbar. */
function FieldsBanner() {
  const t = useTranslations("Contracts.editor")
  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-indigo-50 px-4 py-2 text-sm text-indigo-950 dark:bg-indigo-500/10 dark:text-indigo-100">
      <Braces className="size-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
      <p>
        {t.rich("banner", {
          field: (chunks) => (
            <span className="rounded bg-indigo-100 px-1 text-indigo-800 dark:bg-indigo-500/25 dark:text-indigo-200">
              {chunks}
            </span>
          ),
          strong: (chunks) => <strong className="font-medium">{chunks}</strong>,
        })}
      </p>
    </div>
  )
}

export function NotFound({
  message,
  backHref = routes.templates,
  backLabel,
}: {
  message: string
  backHref?: string
  backLabel?: string
}) {
  const t = useTranslations("Contracts.editor")
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" render={<Link href={backHref} />}>
        <ArrowLeftIcon isHovered className="size-4" />
        {backLabel ?? t("back")}
      </Button>
    </div>
  )
}
