import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { TemplateEditor } from "@/components/contracts/template-editor"
import { requireRole } from "@/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contracts.editor")
  return { title: t("metaTitle") }
}

export default async function NewContractTemplatePage() {
  await requireRole("business")

  return (
    <div className="flex min-h-0 flex-1">
      <TemplateEditor templateId={null} />
    </div>
  )
}
