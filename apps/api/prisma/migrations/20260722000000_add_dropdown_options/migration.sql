-- Add per-tenant configurable dropdown option lists (TC_028)
ALTER TABLE "tenants" ADD COLUMN "dropdownOptions" JSONB;
