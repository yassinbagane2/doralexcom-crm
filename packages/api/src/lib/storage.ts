import { createHash } from "node:crypto"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { env } from "../env"

/*
 * Customer documents live in Cloudflare R2, not the database: uploaded files
 * in S3_INPUT_BUCKET, contracts generated from templates (their editor JSON)
 * in S3_OUTPUT_BUCKET. A document's row holds everything else, and its object
 * key is derived from the row (see `documentKey`), so it isn't stored.
 */

const isNotFound = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode === 404

/**
 * R2's S3-compatible credentials are derived from a Cloudflare API token:
 * access key id = token id, secret access key = SHA-256 of the token value.
 * @see https://developers.cloudflare.com/r2/api/tokens/
 */
const r2CredentialsFromApiToken = (tokenId: string, token: string) => ({
  accessKeyId: tokenId,
  secretAccessKey: createHash("sha256").update(token).digest("hex"),
})

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: r2CredentialsFromApiToken(
    env.CLOUDFLARE_API_TOKEN_ID,
    env.CLOUDFLARE_API_TOKEN
  ),
})

/** Cloudflare R2 via its S3-compatible API, one bucket per instance. */
export class R2StorageService {
  constructor(readonly bucket: string) {}

  async upload(params: {
    key: string
    body: Buffer | Uint8Array | string
    contentType: string
  }): Promise<void> {
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      })
    )
  }

  /** The whole object, or null when nothing is stored at `key`. */
  async getObjectBytes(key: string): Promise<Uint8Array | null> {
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      )
      if (!response.Body) return null
      return await response.Body.transformToByteArray()
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  /** The whole object as UTF-8 text, or null when nothing is stored at `key`. */
  async getObjectText(key: string): Promise<string | null> {
    const bytes = await this.getObjectBytes(key)
    return bytes ? new TextDecoder().decode(bytes) : null
  }

  /** Deleting a key that holds nothing succeeds. */
  async deleteObject(key: string): Promise<void> {
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }
}

export const fileStorage = new R2StorageService(env.S3_INPUT_BUCKET)
export const contractStorage = new R2StorageService(env.S3_OUTPUT_BUCKET)

type StoredDocument = {
  id: string
  organizationId: string
  customerId: string
  kind: "file" | "contract"
}

/** Where a document's content lives: its bucket and object key. */
export function documentStorage(document: StoredDocument) {
  const folder = `${document.organizationId}/customers/${document.customerId}`
  return document.kind === "file"
    ? { storage: fileStorage, key: `${folder}/files/${document.id}` }
    : { storage: contractStorage, key: `${folder}/contracts/${document.id}.json` }
}

/** Stores a contract's editor content. Overwrites the previous version. */
export function saveContractContent(
  document: Omit<StoredDocument, "kind">,
  content: unknown
) {
  const { storage, key } = documentStorage({ ...document, kind: "contract" })
  return storage.upload({
    key,
    body: JSON.stringify(content),
    contentType: "application/json",
  })
}

/**
 * Removes a document's content once its row is gone. Best effort: the row is
 * what makes a document exist, so a leftover object is only wasted space.
 */
export async function discardDocumentContent(document: StoredDocument) {
  const { storage, key } = documentStorage(document)
  try {
    await storage.deleteObject(key)
  } catch (error) {
    console.error(`Could not delete ${storage.bucket}/${key}`, error)
  }
}
