-- Add per-tenant support contact for the help assistant
ALTER TABLE "tenants" ADD COLUMN "supportContact" TEXT;
