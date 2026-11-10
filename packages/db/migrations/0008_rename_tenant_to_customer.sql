-- "Tenant" is now "customer" throughout: the lease's occupant and the
-- documents kept about them.
ALTER TABLE "lease" RENAME COLUMN "tenant_id" TO "customer_id";--> statement-breakpoint
ALTER TABLE "lease" RENAME CONSTRAINT "lease_tenant_id_user_id_fk" TO "lease_customer_id_user_id_fk";--> statement-breakpoint
ALTER INDEX "lease_tenantId_idx" RENAME TO "lease_customerId_idx";--> statement-breakpoint
ALTER TABLE "tenant_document" RENAME TO "customer_document";--> statement-breakpoint
ALTER TABLE "customer_document" RENAME COLUMN "tenant_id" TO "customer_id";--> statement-breakpoint
ALTER TABLE "customer_document" RENAME CONSTRAINT "tenant_document_pkey" TO "customer_document_pkey";--> statement-breakpoint
ALTER TABLE "customer_document" RENAME CONSTRAINT "tenant_document_organization_id_organization_id_fk" TO "customer_document_organization_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "customer_document" RENAME CONSTRAINT "tenant_document_tenant_id_user_id_fk" TO "customer_document_customer_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "customer_document" RENAME CONSTRAINT "tenant_document_lease_id_lease_id_fk" TO "customer_document_lease_id_lease_id_fk";--> statement-breakpoint
ALTER INDEX "tenantDocument_organizationId_idx" RENAME TO "customerDocument_organizationId_idx";--> statement-breakpoint
ALTER INDEX "tenantDocument_tenantId_idx" RENAME TO "customerDocument_customerId_idx";--> statement-breakpoint
ALTER INDEX "tenantDocument_leaseId_idx" RENAME TO "customerDocument_leaseId_idx";--> statement-breakpoint
-- Templates keep their merge fields as `{"key": "tenant.name"}` nodes; point
-- them at the renamed fields. Generated contracts hold plain text, untouched.
UPDATE "template"
SET "content" = regexp_replace(
  "content"::text,
  '"key": "tenant\.',
  '"key": "customer.',
  'g'
)::jsonb
WHERE "content"::text LIKE '%"key": "tenant.%';
