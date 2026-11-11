DROP INDEX "invoice_lease_period_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lease_period_idx" ON "invoice" USING btree ("lease_id","period_start") WHERE voided_at is null;