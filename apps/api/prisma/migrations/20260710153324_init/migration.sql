-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('retail', 'wholesale', 'hospital', 'clinic', 'chain');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'pending_verification', 'trial', 'expired');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('starter', 'professional', 'enterprise');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'locked', 'pending');

-- CreateEnum
CREATE TYPE "MedicineCategory" AS ENUM ('antibiotic', 'analgesic', 'antacid', 'antihistamine', 'antifungal', 'antiviral', 'cardiovascular', 'diabetes', 'dermatology', 'gastroenterology', 'gynecology', 'neurology', 'oncology', 'ophthalmology', 'orthopedic', 'pediatric', 'psychiatry', 'respiratory', 'urology', 'vitamins', 'surgical', 'other');

-- CreateEnum
CREATE TYPE "MedicineForm" AS ENUM ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'patch', 'spray', 'lotion', 'suspension', 'suppository');

-- CreateEnum
CREATE TYPE "MedicineUnit" AS ENUM ('strip', 'bottle', 'vial', 'tube', 'sachet', 'box', 'piece');

-- CreateEnum
CREATE TYPE "DrugSchedule" AS ENUM ('H', 'H1', 'X', 'G', 'C', 'E');

-- CreateEnum
CREATE TYPE "MedicineStatus" AS ENUM ('active', 'discontinued', 'banned');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('available', 'low_stock', 'out_of_stock', 'expired', 'damaged');

-- CreateEnum
CREATE TYPE "ExpiryStatus" AS ENUM ('good', 'expiring_soon', 'expired');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('active', 'exhausted', 'expired', 'returned');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'TRANSFER', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('addition', 'deduction', 'damage', 'return', 'correction');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('sale', 'return', 'credit_note');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('draft', 'completed', 'partially_paid', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'upi', 'netbanking', 'credit', 'insurance');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('walk_in', 'regular', 'vip', 'credit');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('draft', 'pending_review', 'confirmed', 'partial_received', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "VendorPaymentMode" AS ENUM ('cash', 'cheque', 'neft', 'upi', 'rtgs');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('pending_review', 'approved', 'dispensed', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('customer_return', 'vendor_return');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('pending', 'approved', 'processed', 'rejected');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('wrong_medicine', 'damaged', 'expired', 'patient_condition_changed', 'excess_stock', 'near_expiry', 'other');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('cash', 'upi', 'credit_note', 'original_payment');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('resaleable', 'damaged', 'expired');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('expiry_alert', 'low_stock', 'out_of_stock', 'reorder_due', 'payment_due', 'sync_failure', 'backup_failure', 'login_alert', 'approval_required', 'customer_due', 'system');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('inventory', 'billing', 'vendor', 'system', 'customer', 'security');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "ReorderStatus" AS ENUM ('pending', 'ordered', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "ReorderPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ReorderAlertType" AS ENUM ('low_stock', 'critical_stock', 'out_of_stock', 'expiry_risk');

-- CreateEnum
CREATE TYPE "AuditModule" AS ENUM ('billing', 'inventory', 'medicine', 'vendor', 'user', 'settings', 'auth', 'report', 'customer', 'reorder');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'view', 'export', 'login', 'logout', 'login_failed', 'approve', 'reject', 'cancel', 'adjust', 'payment', 'print');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "RefillStatus" AS ENUM ('due_soon', 'due_today', 'overdue', 'completed');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TenantType" NOT NULL DEFAULT 'retail',
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "plan" "TenantPlan" NOT NULL DEFAULT 'starter',
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "licenseNumber" TEXT,
    "gstNumber" TEXT,
    "drugLicenseNumber" TEXT,
    "drugLicenseExpiry" TIMESTAMP(3),
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "expiryAlertDays" INTEGER NOT NULL DEFAULT 90,
    "autoBackup" BOOLEAN NOT NULL DEFAULT true,
    "printBillDefault" BOOLEAN NOT NULL DEFAULT true,
    "requirePrescription" BOOLEAN NOT NULL DEFAULT false,
    "enableOfflineMode" BOOLEAN NOT NULL DEFAULT false,
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 30,
    "language" TEXT NOT NULL DEFAULT 'en',
    "upiId" TEXT,
    "creditLimit" INTEGER NOT NULL DEFAULT 5000,
    "acceptCash" BOOLEAN NOT NULL DEFAULT true,
    "acceptUPI" BOOLEAN NOT NULL DEFAULT true,
    "acceptCard" BOOLEAN NOT NULL DEFAULT true,
    "acceptCredit" BOOLEAN NOT NULL DEFAULT true,
    "defaultGST" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT true,
    "printReceiptOnSale" BOOLEAN NOT NULL DEFAULT true,
    "showGSTOnReceipt" BOOLEAN NOT NULL DEFAULT true,
    "showGenericName" BOOLEAN NOT NULL DEFAULT true,
    "termsOnReceipt" TEXT,
    "thankYouMessage" TEXT,
    "lowStockAlert" BOOLEAN NOT NULL DEFAULT true,
    "expiryAlert" BOOLEAN NOT NULL DEFAULT true,
    "reorderAlert" BOOLEAN NOT NULL DEFAULT true,
    "dailyReport" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReport" BOOLEAN NOT NULL DEFAULT true,
    "monthlyReport" BOOLEAN NOT NULL DEFAULT false,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
    "smsAlerts" BOOLEAN NOT NULL DEFAULT false,
    "whatsappAlerts" BOOLEAN NOT NULL DEFAULT false,
    "alertEmail" TEXT,
    "alertPhone" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "avatarUrl" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "brandName" TEXT,
    "manufacturer" TEXT,
    "category" "MedicineCategory" NOT NULL DEFAULT 'other',
    "form" "MedicineForm" NOT NULL DEFAULT 'tablet',
    "strength" TEXT,
    "unit" "MedicineUnit" NOT NULL DEFAULT 'strip',
    "composition" TEXT,
    "hsn" TEXT,
    "barcode" TEXT,
    "schedule" "DrugSchedule",
    "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "mrp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "description" TEXT,
    "sideEffects" TEXT,
    "storage" TEXT,
    "status" "MedicineStatus" NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "mrp" DOUBLE PRECISION NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "rackNumber" TEXT,
    "rackLocation" TEXT,
    "status" "InventoryStatus" NOT NULL DEFAULT 'available',
    "expiryStatus" "ExpiryStatus" NOT NULL DEFAULT 'good',
    "batchStatus" "BatchStatus" NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "movementType" "MovementType" NOT NULL,
    "adjustmentType" "AdjustmentType",
    "quantity" INTEGER NOT NULL,
    "previousQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "type" "BillType" NOT NULL DEFAULT 'sale',
    "status" "BillStatus" NOT NULL DEFAULT 'draft',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerId" TEXT,
    "doctor" TEXT,
    "prescriptionId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mrp" DOUBLE PRECISION NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "doctorName" TEXT,
    "medicalConditions" TEXT[],
    "allergies" TEXT[],
    "notes" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPurchases" INTEGER NOT NULL DEFAULT 0,
    "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastVisitDate" TIMESTAMP(3),
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "customerType" "CustomerType" NOT NULL DEFAULT 'regular',
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "contactPerson" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPurchases" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastOrderDate" TIMESTAMP(3),
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "status" "VendorStatus" NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentDueDate" TIMESTAMP(3),
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'pending',
    "mismatchFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "mrp" DOUBLE PRECISION NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "mismatch" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" "VendorPaymentMode" NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prescriptionNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "doctorName" TEXT NOT NULL,
    "doctorRegNumber" TEXT,
    "hospitalName" TEXT,
    "prescriptionDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'pending_review',
    "imageUrl" TEXT,
    "imageType" TEXT,
    "billId" TEXT,
    "billNumber" TEXT,
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_medicines" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "quantity" INTEGER,
    "instructions" TEXT,
    "dispensed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "prescription_medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "type" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'pending',
    "billId" TEXT,
    "billNumber" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "purchaseInvoiceId" TEXT,
    "purchaseInvoiceNumber" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundMethod" "RefundMethod",
    "reason" "ReturnReason" NOT NULL,
    "reasonNotes" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "returnQty" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "restocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "entityId" TEXT,
    "entityName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "suggestedQty" INTEGER NOT NULL DEFAULT 0,
    "priority" "ReorderPriority" NOT NULL DEFAULT 'medium',
    "status" "ReorderStatus" NOT NULL DEFAULT 'pending',
    "lastSaleQty30Days" INTEGER NOT NULL DEFAULT 0,
    "daysStockLeft" INTEGER NOT NULL DEFAULT 0,
    "preferredVendor" TEXT,
    "lastPurchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_vendor_suggestions" (
    "id" TEXT NOT NULL,
    "reorderItemId" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "lastPrice" DOUBLE PRECISION NOT NULL,
    "lastOrderDate" TIMESTAMP(3),
    "leadTimeDays" INTEGER NOT NULL DEFAULT 1,
    "reliability" TEXT,

    CONSTRAINT "reorder_vendor_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "alertType" "ReorderAlertType" NOT NULL,
    "currentQty" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reorder_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "module" "AuditModule" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "description" TEXT NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'info',
    "status" "AuditStatus" NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "userRole" TEXT,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "actionsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refill_reminders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "medicine" TEXT NOT NULL,
    "generic" TEXT,
    "lastPurchaseDate" TIMESTAMP(3) NOT NULL,
    "daysSupply" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "doctorName" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "daysOverdue" INTEGER NOT NULL DEFAULT 0,
    "status" "RefillStatus" NOT NULL DEFAULT 'due_soon',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refill_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_action_resource_key" ON "permissions"("module", "action", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "otp_codes_userId_idx" ON "otp_codes"("userId");

-- CreateIndex
CREATE INDEX "medicines_tenantId_idx" ON "medicines"("tenantId");

-- CreateIndex
CREATE INDEX "medicines_tenantId_category_idx" ON "medicines"("tenantId", "category");

-- CreateIndex
CREATE INDEX "medicines_barcode_idx" ON "medicines"("barcode");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_idx" ON "inventory_items"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_items_medicineId_idx" ON "inventory_items"("medicineId");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_status_idx" ON "inventory_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "inventory_items_expiryDate_idx" ON "inventory_items"("expiryDate");

-- CreateIndex
CREATE INDEX "stock_movements_tenantId_idx" ON "stock_movements"("tenantId");

-- CreateIndex
CREATE INDEX "stock_movements_medicineId_idx" ON "stock_movements"("medicineId");

-- CreateIndex
CREATE INDEX "stock_movements_inventoryItemId_idx" ON "stock_movements"("inventoryItemId");

-- CreateIndex
CREATE INDEX "bills_tenantId_idx" ON "bills"("tenantId");

-- CreateIndex
CREATE INDEX "bills_tenantId_status_idx" ON "bills"("tenantId", "status");

-- CreateIndex
CREATE INDEX "bills_tenantId_createdAt_idx" ON "bills"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bills_tenantId_billNumber_key" ON "bills"("tenantId", "billNumber");

-- CreateIndex
CREATE INDEX "bill_items_billId_idx" ON "bill_items"("billId");

-- CreateIndex
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");

-- CreateIndex
CREATE INDEX "customers_tenantId_customerType_idx" ON "customers"("tenantId", "customerType");

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_invoices_tenantId_idx" ON "purchase_invoices"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_invoices_vendorId_idx" ON "purchase_invoices"("vendorId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_invoiceId_idx" ON "purchase_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "vendor_payments_tenantId_idx" ON "vendor_payments"("tenantId");

-- CreateIndex
CREATE INDEX "vendor_payments_vendorId_idx" ON "vendor_payments"("vendorId");

-- CreateIndex
CREATE INDEX "prescriptions_tenantId_idx" ON "prescriptions"("tenantId");

-- CreateIndex
CREATE INDEX "prescriptions_tenantId_status_idx" ON "prescriptions"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_tenantId_prescriptionNumber_key" ON "prescriptions"("tenantId", "prescriptionNumber");

-- CreateIndex
CREATE INDEX "prescription_medicines_prescriptionId_idx" ON "prescription_medicines"("prescriptionId");

-- CreateIndex
CREATE INDEX "return_requests_tenantId_idx" ON "return_requests"("tenantId");

-- CreateIndex
CREATE INDEX "return_requests_tenantId_type_idx" ON "return_requests"("tenantId", "type");

-- CreateIndex
CREATE INDEX "return_requests_tenantId_status_idx" ON "return_requests"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_tenantId_returnNumber_key" ON "return_requests"("tenantId", "returnNumber");

-- CreateIndex
CREATE INDEX "return_items_returnId_idx" ON "return_items"("returnId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_isRead_idx" ON "notifications"("tenantId", "isRead");

-- CreateIndex
CREATE INDEX "reorder_items_tenantId_idx" ON "reorder_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "reorder_items_tenantId_medicineId_key" ON "reorder_items"("tenantId", "medicineId");

-- CreateIndex
CREATE INDEX "reorder_alerts_tenantId_idx" ON "reorder_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_module_idx" ON "audit_logs"("tenantId", "module");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_userId_idx" ON "audit_logs"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "user_sessions_tenantId_idx" ON "user_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "security_events_tenantId_idx" ON "security_events"("tenantId");

-- CreateIndex
CREATE INDEX "refill_reminders_tenantId_idx" ON "refill_reminders"("tenantId");

-- CreateIndex
CREATE INDEX "refill_reminders_tenantId_status_idx" ON "refill_reminders"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_items" ADD CONSTRAINT "reorder_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_items" ADD CONSTRAINT "reorder_items_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_vendor_suggestions" ADD CONSTRAINT "reorder_vendor_suggestions_reorderItemId_fkey" FOREIGN KEY ("reorderItemId") REFERENCES "reorder_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_alerts" ADD CONSTRAINT "reorder_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_reminders" ADD CONSTRAINT "refill_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_reminders" ADD CONSTRAINT "refill_reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
