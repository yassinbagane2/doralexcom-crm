CREATE TABLE "contract_template" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_document" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lease_id" uuid,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size" integer,
	"data" "bytea",
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "charges" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "additional_costs" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "discount" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "deposit" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "term_months" integer;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_template" ADD CONSTRAINT "contract_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_document" ADD CONSTRAINT "tenant_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_document" ADD CONSTRAINT "tenant_document_tenant_id_user_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_document" ADD CONSTRAINT "tenant_document_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contractTemplate_organizationId_idx" ON "contract_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenantDocument_organizationId_idx" ON "tenant_document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenantDocument_tenantId_idx" ON "tenant_document" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenantDocument_leaseId_idx" ON "tenant_document" USING btree ("lease_id");