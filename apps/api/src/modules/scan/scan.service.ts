import { Prisma, MedicineCategory, MedicineForm, MedicineUnit } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../utils/audit';

export interface ScanCommitItem {
  medicineName: string;
  genericName?: string;
  category?: string;
  form?: string;
  hsn?: string;
  gstRate?: number;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
}

export interface ScanCommitInput {
  vendor: { name: string; phone?: string; gstNumber?: string };
  invoiceNumber?: string;
  invoiceDate?: string;
  notes?: string;
  items: ScanCommitItem[];
}

function expiryStatusFor(expiry: Date, alertDays: number): 'good' | 'expiring_soon' | 'expired' {
  const now = Date.now();
  if (expiry.getTime() < now) return 'expired';
  const daysLeft = (expiry.getTime() - now) / 86_400_000;
  return daysLeft <= alertDays ? 'expiring_soon' : 'good';
}

/**
 * Commits a human-reviewed scanned purchase bill in one transaction:
 *  vendor (find or create) → purchase invoice → for each line: medicine
 *  (find or create in the master) → inventory batch → stock movement (PURCHASE).
 * Nothing is written until the user has confirmed the review table.
 */
export async function commitScannedInvoice(tenantId: string, input: ScanCommitInput, userId: string, userName: string) {
  if (!input.vendor?.name?.trim()) throw new AppError('Vendor name is required', 422);
  const items = (input.items ?? []).filter(i => i.medicineName?.trim());
  if (items.length === 0) throw new AppError('At least one line item is required', 422);

  for (const [i, it] of items.entries()) {
    if (!it.batchNumber?.trim()) throw new AppError(`Row ${i + 1}: batch number is required`, 422);
    if (!it.expiryDate || isNaN(Date.parse(it.expiryDate))) throw new AppError(`Row ${i + 1}: valid expiry date is required`, 422);
    if (!(it.quantity > 0)) throw new AppError(`Row ${i + 1}: quantity must be greater than 0`, 422);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { expiryAlertDays: true } });
  const alertDays = tenant?.expiryAlertDays ?? 90;

  const result = await prisma.$transaction(async tx => {
    // 1. Vendor — find by name, else create
    let vendor = await tx.vendor.findFirst({ where: { tenantId, name: { equals: input.vendor.name.trim(), mode: 'insensitive' }, deletedAt: null } });
    let vendorCreated = false;
    if (!vendor) {
      vendor = await tx.vendor.create({
        data: { tenantId, name: input.vendor.name.trim(), phone: input.vendor.phone, gstNumber: input.vendor.gstNumber, status: 'active', createdBy: userId },
      });
      vendorCreated = true;
    }

    // 2. Purchase invoice
    const subtotal = items.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);
    const taxAmount = items.reduce((s, i) => s + (i.purchasePrice * i.quantity * (i.gstRate ?? 0)) / 100, 0);
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
    const invoiceNumber = input.invoiceNumber?.trim() || `SCAN-${Date.now()}`;
    const invoice = await tx.purchaseInvoice.create({
      data: {
        tenantId, vendorId: vendor.id, vendorName: vendor.name, invoiceNumber,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
        status: 'completed', subtotal, taxAmount, totalAmount, paidAmount: 0, pendingAmount: totalAmount,
        ocrStatus: 'completed', notes: input.notes ?? 'Created from scanned bill', createdBy: userId, updatedBy: userId,
      },
    });

    const medicinesCreated: string[] = [];
    let batchesAdded = 0;
    let totalQty = 0;

    for (const it of items) {
      const expiry = new Date(it.expiryDate);

      // 3. Medicine — find by name, else create in the master
      let medicine = await tx.medicine.findFirst({ where: { tenantId, name: { equals: it.medicineName.trim(), mode: 'insensitive' }, deletedAt: null } });
      if (!medicine) {
        medicine = await tx.medicine.create({
          data: {
            tenantId, name: it.medicineName.trim(), genericName: it.genericName?.trim() || null,
            category: (it.category as MedicineCategory) ?? 'other',
            form: (it.form as MedicineForm) ?? 'tablet',
            unit: 'strip' as MedicineUnit,
            hsn: it.hsn?.trim() || null,
            gstRate: it.gstRate ?? 12, mrp: it.mrp ?? 0, purchasePrice: it.purchasePrice ?? 0, sellingPrice: it.sellingPrice ?? 0,
            reorderLevel: 10, status: 'active', createdBy: userId, updatedBy: userId,
          },
        });
        medicinesCreated.push(medicine.name);
      }

      // 4. Purchase invoice line item
      await tx.purchaseInvoiceItem.create({
        data: {
          invoiceId: invoice.id, medicineName: medicine.name, batchNumber: it.batchNumber.trim(), expiryDate: expiry,
          quantity: it.quantity, receivedQuantity: it.quantity, purchasePrice: it.purchasePrice, mrp: it.mrp,
          sellingPrice: it.sellingPrice, gstRate: it.gstRate ?? 12, gstAmount: (it.purchasePrice * it.quantity * (it.gstRate ?? 0)) / 100,
          totalAmount: it.purchasePrice * it.quantity, mismatch: false,
        },
      });

      // 5. Inventory batch
      const batch = await tx.inventoryItem.create({
        data: {
          tenantId, medicineId: medicine.id, batchNumber: it.batchNumber.trim(), quantity: it.quantity,
          purchasePrice: it.purchasePrice, mrp: it.mrp, sellingPrice: it.sellingPrice, expiryDate: expiry,
          supplierId: vendor.id, status: 'available', expiryStatus: expiryStatusFor(expiry, alertDays),
          batchStatus: 'active', createdBy: userId, updatedBy: userId,
        },
      });
      batchesAdded++;
      totalQty += it.quantity;

      // 6. Stock movement (PURCHASE)
      await tx.stockMovement.create({
        data: {
          tenantId, medicineId: medicine.id, inventoryItemId: batch.id, movementType: 'PURCHASE',
          quantity: it.quantity, previousQty: 0, newQty: it.quantity, referenceId: invoice.id,
          referenceType: 'purchase_scan', notes: `Scanned bill ${invoiceNumber}`, createdBy: userId,
        },
      });
    }

    return { vendor, vendorCreated, invoice, medicinesCreated, batchesAdded, totalQty };
  });

  await createAuditLog({
    tenantId, userId, userName, module: 'inventory', action: 'create',
    entityId: result.invoice.id, entityName: result.invoice.invoiceNumber,
    description: `Scanned bill committed: ${result.batchesAdded} batches, ${result.medicinesCreated.length} new medicines, vendor ${result.vendor.name}${result.vendorCreated ? ' (new)' : ''}`,
    severity: 'info',
  });

  return {
    vendor: { id: result.vendor.id, name: result.vendor.name, created: result.vendorCreated },
    invoice: { id: result.invoice.id, invoiceNumber: result.invoice.invoiceNumber, totalAmount: result.invoice.totalAmount },
    medicinesCreated: result.medicinesCreated,
    newMedicineCount: result.medicinesCreated.length,
    batchesAdded: result.batchesAdded,
    totalQty: result.totalQty,
  };
}
