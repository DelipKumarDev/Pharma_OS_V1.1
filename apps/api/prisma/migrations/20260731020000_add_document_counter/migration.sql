-- Per-tenant document counters for collision-free sequential numbering
CREATE TABLE "document_counters" (
    "tenantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("tenantId", "docType")
);

-- Seed each tenant's bill counter from its current bill count so numbering
-- continues from where the old count()+1 scheme left off (no re-issued numbers).
INSERT INTO "document_counters" ("tenantId", "docType", "nextValue")
SELECT "tenantId", 'bill', COUNT(*)::int FROM "bills" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "docType") DO NOTHING;
