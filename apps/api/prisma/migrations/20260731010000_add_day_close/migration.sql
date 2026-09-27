-- Server-side, auditable end-of-day cash reconciliation
CREATE TABLE "day_closes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "closeDate" DATE NOT NULL,
    "systemCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "physicalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billCount" INTEGER NOT NULL DEFAULT 0,
    "denominations" JSONB,
    "notes" TEXT,
    "closedBy" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "day_closes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "day_closes_tenantId_closeDate_key" ON "day_closes"("tenantId", "closeDate");
CREATE INDEX "day_closes_tenantId_idx" ON "day_closes"("tenantId");

ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
