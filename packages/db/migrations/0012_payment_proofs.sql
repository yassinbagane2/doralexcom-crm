CREATE TABLE "payment_proof" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"submitted_by_id" uuid,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_lease_id_lease_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."lease"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_submitted_by_id_user_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paymentProof_leaseId_idx" ON "payment_proof" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "paymentProof_invoiceId_idx" ON "payment_proof" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paymentProof_paymentId_idx" ON "payment_proof" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paymentProof_pending_idx" ON "payment_proof" USING btree ("invoice_id") WHERE status = 'pending';