CREATE TABLE "custom_domain" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"verification_token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp,
	"last_checked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_domain_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"from_name" text,
	"from_email" text NOT NULL,
	"reply_to" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_username" text,
	"secret" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "legal_structure" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "iban" text;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD CONSTRAINT "custom_domain_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customDomain_hostname_idx" ON "custom_domain" USING btree ("hostname");--> statement-breakpoint
CREATE UNIQUE INDEX "customDomain_active_hostname_idx" ON "custom_domain" USING btree ("hostname") WHERE status = 'active';