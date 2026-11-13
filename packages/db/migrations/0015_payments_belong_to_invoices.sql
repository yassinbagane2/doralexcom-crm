ALTER TABLE "payment" DROP CONSTRAINT "payment_lease_id_lease_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_proof" DROP CONSTRAINT "payment_proof_lease_id_lease_id_fk";
--> statement-breakpoint
DROP INDEX "payment_leaseId_idx";--> statement-breakpoint
DROP INDEX "paymentProof_leaseId_idx";--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN "lease_id";--> statement-breakpoint
ALTER TABLE "payment_proof" DROP COLUMN "lease_id";