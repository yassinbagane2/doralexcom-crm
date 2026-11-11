CREATE TABLE "document_event" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"type" text NOT NULL,
	"role" text,
	"actor_user_id" uuid,
	"actor_name" text,
	"actor_email" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_signature" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"role" text NOT NULL,
	"signer_user_id" uuid,
	"signer_name" text NOT NULL,
	"signer_email" text,
	"image" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"signed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"issued_on" date NOT NULL,
	"due_on" date NOT NULL,
	"lines" jsonb NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"voided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_signature" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"signer_name" text NOT NULL,
	"image" text NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_document" ADD COLUMN "signature_status" text;--> statement-breakpoint
ALTER TABLE "customer_document" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "customer_document" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "customer_document" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "customer_document" ADD COLUMN "signed_file_hash" text;--> statement-breakpoint
-- Payments now settle invoices. Earlier ones were recorded against the lease
-- alone (development data only), so they are cleared rather than migrated.
DELETE FROM "payment";--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "invoice_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "document_event" ADD CONSTRAINT "document_event_document_id_customer_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."customer_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_event" ADD CONSTRAINT "document_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signature" ADD CONSTRAINT "document_signature_document_id_customer_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."customer_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signature" ADD CONSTRAINT "document_signature_signer_user_id_user_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_signature" ADD CONSTRAINT "organization_signature_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_signature" ADD CONSTRAINT "organization_signature_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentEvent_documentId_idx" ON "document_event" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentSignature_document_role_idx" ON "document_signature" USING btree ("document_id","role");--> statement-breakpoint
CREATE INDEX "invoice_organizationId_idx" ON "invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoice_leaseId_idx" ON "invoice" USING btree ("lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_organization_number_idx" ON "invoice" USING btree ("organization_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lease_period_idx" ON "invoice" USING btree ("lease_id","period_start");--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_invoiceId_idx" ON "payment" USING btree ("invoice_id");