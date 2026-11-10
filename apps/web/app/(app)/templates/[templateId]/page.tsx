import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { TemplateEditor } from "@/components/contracts/template-editor"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contracts.editor")
  return { title: t("metaTitle") }
}

export default async function ContractTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>
}) {
  await requireRole("business")
  const { templateId } = await params

  return (
    <div className="flex min-h-0 flex-1">
      {/* Keyed so moving to another template opens a fresh editor. */}
      <TemplateEditor key={templateId} templateId={templateId} />
    </div>
  )
}
