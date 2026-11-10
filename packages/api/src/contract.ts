import { z } from "zod"

/*
 * Contracts and tenant documents, shared by the API and the web app. Keep this
 * file free of server imports: it ends up in client bundles.
 */

export const CONTRACT_LIMITS = {
  name: 200,
  /** Serialized editor content, images included. */
  contentBytes: 15 * 1024 * 1024,
} as const

export const DOCUMENT_LIMITS = {
  name: 200,
  fileBytes: 10 * 1024 * 1024,
} as const

/**
 * What can be uploaded to a tenant, with the extension it saves under. Kept
 * to documents and photos: nothing a browser would run as a page.
 */
export const DOCUMENT_FILE_TYPES = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "text/plain": "txt",
} as const

export type DocumentFileType = keyof typeof DOCUMENT_FILE_TYPES

export function isDocumentFileType(type: string): type is DocumentFileType {
  return Object.hasOwn(DOCUMENT_FILE_TYPES, type)
}

/** Opened in a new tab rather than downloaded. */
export const PREVIEWABLE_FILE_TYPES: readonly DocumentFileType[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]

export const DOCUMENT_KINDS = ["file", "contract"] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

// --- Merge fields ------------------------------------------------------------

/** The editor node a merge field is stored as (see the web app's merge-field.ts). */
export const MERGE_FIELD_NODE = "mergeField"

export const MERGE_FIELD_GROUPS = [
  "landlord",
  "tenant",
  "property",
  "lease",
  "document",
] as const

export type MergeFieldGroup = (typeof MERGE_FIELD_GROUPS)[number]

/**
 * Everything a contract template can fill in. Keys are stored in templates,
 * so rename one only with a migration of the saved content.
 */
export const MERGE_FIELDS = [
  "landlord.name",
  "landlord.representative",
  "landlord.email",
  "landlord.taxId",
  "landlord.registrationNumber",
  "tenant.name",
  "tenant.email",
  "tenant.phone",
  "tenant.address",
  "property.name",
  "property.type",
  "property.address",
  "property.surfaceArea",
  "property.description",
  "lease.startDate",
  "lease.endDate",
  "lease.length",
  "lease.renewal",
  "lease.rent",
  "lease.charges",
  "lease.additionalCosts",
  "lease.discount",
  "lease.monthlyTotal",
  "lease.deposit",
  "lease.currency",
  "document.date",
] as const

export type MergeFieldKey = (typeof MERGE_FIELDS)[number]

export function mergeFieldGroup(key: MergeFieldKey) {
  return key.split(".")[0] as MergeFieldGroup
}

export function isMergeFieldKey(key: unknown): key is MergeFieldKey {
  return (MERGE_FIELDS as readonly unknown[]).includes(key)
}

/** Printed where a field has no value, for filling in by hand. */
export const BLANK_FIELD = "____________"

/** An editor JSON node, as far as filling fields is concerned. */
export interface ContentNode {
  type?: string
  attrs?: Record<string, unknown>
  content?: ContentNode[]
  marks?: unknown[]
  text?: string
  [key: string]: unknown
}

/**
 * Replaces every merge field under `node` with its value as plain text,
 * keeping the field's formatting. A field without a value becomes a blank.
 */
export function fillMergeFields<T extends ContentNode>(
  node: T,
  values: Partial<Record<MergeFieldKey, string>>
): T {
  if (node.type === MERGE_FIELD_NODE) {
    const key = node.attrs?.key
    const value = isMergeFieldKey(key) ? values[key]?.trim() : undefined
    return {
      type: "text",
      // ProseMirror refuses empty text nodes.
      text: value || BLANK_FIELD,
      ...(node.marks?.length ? { marks: node.marks } : {}),
    } as unknown as T
  }
  if (!node.content) return node
  return {
    ...node,
    content: node.content.map((child) => fillMergeFields(child, values)),
  }
}

// --- Editor content ----------------------------------------------------------

const editorDoc = z.looseObject({ type: z.literal("doc") })

/** A document as the editor saves it: body, page header and footer, layout. */
export const documentContentSchema = z.object({
  version: z.literal(1),
  body: editorDoc,
  header: editorDoc.nullable(),
  footer: editorDoc.nullable(),
  pageSetup: z.object({
    size: z.string().max(20),
    orientation: z.enum(["portrait", "landscape"]),
    margin: z.string().max(20),
    sideMargin: z.number().finite().nonnegative().max(100).nullable(),
  }),
  themeId: z.string().max(40),
})

export type DocumentContent = z.infer<typeof documentContentSchema>
