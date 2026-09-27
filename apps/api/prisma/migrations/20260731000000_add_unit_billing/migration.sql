-- Unit-level (loose tablet) billing support
ALTER TABLE "medicines" ADD COLUMN "unitsPerPack" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inventory_items" ADD COLUMN "looseUnits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bill_items" ADD COLUMN "saleUnit" TEXT NOT NULL DEFAULT 'pack';
ALTER TABLE "bill_items" ADD COLUMN "unitsPerPack" INTEGER NOT NULL DEFAULT 1;
