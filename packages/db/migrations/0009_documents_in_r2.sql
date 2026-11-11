-- Customer documents' content now lives in Cloudflare R2. Run
-- `pnpm --filter server documents:to-r2` BEFORE this migration to copy what
-- these columns hold into the buckets; this drops it.
ALTER TABLE "customer_document" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "customer_document" DROP COLUMN "content";
