-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'suspended';

-- CreateTable
CREATE TABLE "schedule_drug_register" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billId" TEXT,
    "billNumber" TEXT,
    "billItemId" TEXT,
    "medicineId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "schedule" "DrugSchedule" NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientAddress" TEXT,
    "patientPhone" TEXT,
    "doctorName" TEXT NOT NULL,
    "doctorRegNumber" TEXT,
    "prescriptionDate" TIMESTAMP(3),
    "dispensedBy" TEXT NOT NULL,
    "dispensedByName" TEXT,
    "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_drug_register_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_drug_register_tenantId_idx" ON "schedule_drug_register"("tenantId");

-- CreateIndex
CREATE INDEX "schedule_drug_register_tenantId_schedule_idx" ON "schedule_drug_register"("tenantId", "schedule");

-- CreateIndex
CREATE INDEX "schedule_drug_register_tenantId_dispensedAt_idx" ON "schedule_drug_register"("tenantId", "dispensedAt");

-- AddForeignKey
ALTER TABLE "schedule_drug_register" ADD CONSTRAINT "schedule_drug_register_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

