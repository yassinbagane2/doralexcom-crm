ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp;--> statement-breakpoint
-- Accounts from before roles existed: whoever owns an organization runs a business.
UPDATE "user" SET "role" = 'business' WHERE "id" IN (SELECT "user_id" FROM "member" WHERE "role" = 'owner');--> statement-breakpoint
UPDATE "user" SET "role" = 'user' WHERE "role" IS NULL;
