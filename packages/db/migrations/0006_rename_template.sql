ALTER TABLE "contract_template" RENAME TO "template";--> statement-breakpoint
ALTER TABLE "template" RENAME CONSTRAINT "contract_template_organization_id_organization_id_fk" TO "template_organization_id_organization_id_fk";--> statement-breakpoint
ALTER INDEX "contractTemplate_organizationId_idx" RENAME TO "template_organizationId_idx";
