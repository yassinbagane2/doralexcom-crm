CREATE TABLE "lease" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"rent" numeric(12, 2) DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'RON' NOT NULL,
	"terminated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property" DROP CONSTRAINT "property_tenant_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "property_tenantId_idx";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_tenant_id_user_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease" ADD CONSTRAINT "lease_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lease_organizationId_idx" ON "lease" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lease_tenantId_idx" ON "lease" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lease_propertyId_idx" ON "lease" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "payment_leaseId_idx" ON "payment" USING btree ("lease_id");--> statement-breakpoint
-- Properties used to point straight at their tenant's account. Each such
-- assignment becomes a lease starting on the day the property last changed.
INSERT INTO "lease" ("organization_id", "tenant_id", "property_id", "start_date", "rent", "currency")
SELECT "organization_id", "tenant_id", "id", "updated_at"::date, COALESCE("rent", 0), "currency"
FROM "property"
WHERE "tenant_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "tenant_id";