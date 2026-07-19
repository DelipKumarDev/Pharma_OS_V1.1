-- Add per-tenant configurable message templates
ALTER TABLE "tenants" ADD COLUMN "messageTemplates" JSONB;
