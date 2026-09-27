-- Per-tenant menu visibility (per role) and form-field configuration
ALTER TABLE "tenants" ADD COLUMN "menuAccess" JSONB;
ALTER TABLE "tenants" ADD COLUMN "formFields" JSONB;
