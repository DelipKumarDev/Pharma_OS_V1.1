-- Convert all monetary Float columns to DECIMAL(12,2) for exact currency arithmetic.
-- Data-preserving: Postgres implicitly casts double precision -> numeric, rounding to paise.
-- Rates/percentages (gstRate, defaultGST, discountPercent) and rating stay Float by design.

-- AlterTable
ALTER TABLE "bill_items" ALTER COLUMN "mrp" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "gstAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "bills" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "balanceAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "totalSpend" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "creditBalance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "day_closes" ALTER COLUMN "systemCash" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "systemUpi" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "systemCard" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "systemCredit" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "systemTotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "physicalCash" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "variance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "inventory_items" ALTER COLUMN "purchasePrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "mrp" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "medicines" ALTER COLUMN "mrp" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "purchasePrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "purchase_invoice_items" ALTER COLUMN "purchasePrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "mrp" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "gstAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "purchase_invoices" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "paidAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "pendingAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "purchase_order_items" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "purchase_orders" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "reorder_items" ALTER COLUMN "lastPurchasePrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "reorder_vendor_suggestions" ALTER COLUMN "lastPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "return_items" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "return_requests" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "refundAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "vendor_payments" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "vendors" ALTER COLUMN "creditLimit" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalPurchases" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "pendingPayment" SET DATA TYPE DECIMAL(12,2);

