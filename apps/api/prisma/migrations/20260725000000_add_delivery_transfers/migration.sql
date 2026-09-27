CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE "TransferStatus" AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE "delivery_orders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "billId" TEXT,
  "billNumber" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT,
  "address" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
  "assignedTo" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deliveredAt" TIMESTAMP(3),
  CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_transfers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "transferNumber" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "medicineId" TEXT NOT NULL,
  "medicineName" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "fromLocation" TEXT,
  "toLocation" TEXT NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'completed',
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_orders_tenantId_idx" ON "delivery_orders"("tenantId");
CREATE INDEX "stock_transfers_tenantId_idx" ON "stock_transfers"("tenantId");
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
