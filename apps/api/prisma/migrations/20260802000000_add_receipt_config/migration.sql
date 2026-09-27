-- Per-tenant receipt/print configuration
ALTER TABLE "tenants" ADD COLUMN "receiptConfig" JSONB;
