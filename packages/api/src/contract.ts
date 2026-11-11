import { z } from "zod"

/*
 * Contracts and customer documents, shared by the API and the web app. Keep this
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
 * What can be uploaded to a customer, with the extension it saves under. Kept
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
  "customer",
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
  "landlord.legalStructure",
  "landlord.address",
  "landlord.taxId",
  "landlord.registrationNumber",
  "landlord.vatNumber",
  "landlord.bankName",
  "landlord.iban",
  "customer.name",
  "customer.email",
  "customer.phone",
  "customer.address",
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

// --- Signatures --------------------------------------------------------------

/** The editor node a signature field is stored as (see the web app's signature-field.ts). */
export const SIGNATURE_FIELD_NODE = "signatureField"

/** Who signs a contract: the business (as landlord) and its customer. */
export const SIGNER_ROLES = ["landlord", "customer"] as const

export type SignerRole = (typeof SIGNER_ROLES)[number]

export function isSignerRole(role: unknown): role is SignerRole {
  return (SIGNER_ROLES as readonly unknown[]).includes(role)
}

export const SIGNATURE_LIMITS = {
  /** A signature PNG, as a data URL. */
  imageChars: 400_000,
  name: 100,
} as const

/** A signature as drawn, typed or uploaded: always a PNG data URL. */
export const signatureImageSchema = z
  .string()
  .max(SIGNATURE_LIMITS.imageChars)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, {
    message: "The signature must be a PNG image.",
  })

export const signerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(SIGNATURE_LIMITS.name)

export const SIGNATURE_STATUSES = ["pending", "completed"] as const

export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number]

/** A party's signature, as it fills that party's fields. */
export interface AppliedSignature {
  image: string
  name: string
  /** ISO timestamp. */
  signedAt: string
}

/** Which parties a document has signature fields for. */
export function signatureRoles(
  ...nodes: (ContentNode | null | undefined)[]
): Set<SignerRole> {
  const roles = new Set<SignerRole>()
  const visit = (node: ContentNode) => {
    if (node.type === SIGNATURE_FIELD_NODE && isSignerRole(node.attrs?.role)) {
      roles.add(node.attrs.role)
    }
    node.content?.forEach(visit)
  }
  for (const node of nodes) if (node) visit(node)
  return roles
}

/**
 * Every signature field under `node` with its party's signature filled in,
 * or emptied when that party hasn't signed. Saved content always goes
 * through this with no signatures, so nobody can slip one into a draft.
 */
export function fillSignatures<T extends ContentNode>(
  node: T,
  signatures: Partial<Record<SignerRole, AppliedSignature>>
): T {
  if (node.type === SIGNATURE_FIELD_NODE) {
    const role = node.attrs?.role
    const signature = isSignerRole(role) ? signatures[role] : undefined
    return {
      ...node,
      attrs: {
        role: isSignerRole(role) ? role : "customer",
        image: signature?.image ?? null,
        signerName: signature?.name ?? null,
        signedAt: signature?.signedAt ?? null,
      },
    }
  }
  if (!node.content) return node
  return {
    ...node,
    content: node.content.map((child) => fillSignatures(child, signatures)),
  }
}

/** A document's body, header and footer with `fillSignatures` applied. */
export function fillDocumentSignatures(
  content: DocumentContent,
  signatures: Partial<Record<SignerRole, AppliedSignature>>
): DocumentContent {
  return {
    ...content,
    body: fillSignatures(content.body, signatures),
    header: content.header && fillSignatures(content.header, signatures),
    footer: content.footer && fillSignatures(content.footer, signatures),
  }
}
