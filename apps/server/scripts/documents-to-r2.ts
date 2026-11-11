/*
 * One-off: copies customer documents' content out of Postgres into R2, before
 * migration 0009_documents_in_r2 drops the columns that hold it:
 *
 *   pnpm --filter server documents:to-r2
 *   pnpm --filter @workspace/db db:migrate
 *
 * Safe to run again: each document is written to the same key. Does nothing
 * once the columns are gone.
 */
import { documentStorage, saveContractContent } from "@workspace/api/storage"
import { db } from "@workspace/db"
import { sql } from "drizzle-orm"

type Row = {
  id: string
  organization_id: string
  customer_id: string
  kind: "file" | "contract"
  mime_type: string | null
  data: Buffer | null
  content: unknown
}

const { rows: columns } = await db.execute<{ column_name: string }>(sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'customer_document' AND column_name IN ('data', 'content')
`)
if (columns.length < 2) {
  console.log("customer_document has no content columns left: nothing to copy.")
  process.exit(0)
}

const { rows } = await db.execute<Row>(sql`
  SELECT id, organization_id, customer_id, kind, mime_type, data, content
  FROM customer_document
`)

let copied = 0
let failed = 0
for (const row of rows) {
  const document = {
    id: row.id,
    organizationId: row.organization_id,
    customerId: row.customer_id,
    kind: row.kind,
  }
  try {
    if (row.kind === "file" && row.data) {
      const { storage, key } = documentStorage(document)
      await storage.upload({
        key,
        body: row.data,
        contentType: row.mime_type ?? "application/octet-stream",
      })
    } else if (row.kind === "contract" && row.content) {
      await saveContractContent(document, row.content)
    } else {
      console.warn(`Skipped ${row.kind} ${row.id}: it has no content.`)
      continue
    }
    copied++
  } catch (error) {
    failed++
    console.error(`Could not copy ${row.kind} ${row.id}`, error)
  }
}

console.log(`Copied ${copied} of ${rows.length} documents to R2.`)
if (failed > 0) {
  console.error(`${failed} failed: fix and run again before migrating.`)
  process.exit(1)
}
process.exit(0)
