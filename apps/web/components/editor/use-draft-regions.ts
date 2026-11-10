"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useEditor, type Content, type Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import { createDraftExtensions } from "./extensions"
import type { PageRegion } from "./draft-page-regions"

function useRegionEditor(
  placeholder: string,
  content: Content,
  fieldLabel: (key: string) => string
) {
  return useEditor({
    extensions: createDraftExtensions(placeholder, {
      paginate: false,
      fieldLabel,
    }),
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content,
  })
}

export type DraftRegions = ReturnType<typeof useDraftRegions>

/**
 * The page header and footer. Each is one editor whose content repeats on every
 * page; `active` is the page whose header or footer is being edited, and the
 * body editor taking focus back ends it.
 */
export function useDraftRegions(
  body: Editor | null,
  initial: { header: Content; footer: Content },
  fieldLabel: (key: string) => string
) {
  const t = useTranslations("Editor")
  const header = useRegionEditor(
    t("headerPlaceholder"),
    initial.header,
    fieldLabel
  )
  const footer = useRegionEditor(
    t("footerPlaceholder"),
    initial.footer,
    fieldLabel
  )
  const [active, setActive] = useState<PageRegion | null>(null)

  useEffect(() => {
    if (!body) return
    const onFocus = () => setActive(null)
    body.on("focus", onFocus)
    return () => {
      body.off("focus", onFocus)
    }
  }, [body])

  const exit = useCallback(() => {
    setActive(null)
    body?.commands.focus()
  }, [body])

  const editors = useMemo(
    () => (header && footer ? { header, footer } : null),
    [header, footer]
  )
  return { editors, active, activate: setActive, exit }
}
