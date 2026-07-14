import { Prisma, BillStatus, PaymentMethod, DrugSchedule } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../utils/audit';
import { paginate } from '../../utils/response';

interface CreateBillInput {
  type?: string;
  customer?: { id?: string; name: string; phone?: string; email?: string };
  doctor?: string;
  prescriptionId?: string;
  items: Array<{
    medicineId: string;
    inventoryItemId?: string;
    medicineName: string;
    genericName?: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    mrp: number;
    sellingPrice: number;
    discount?: number;
    gstRate?: number;
    gstAmount?: number;
    totalAmount: number;
  }>;
  discountPercent?: number;
  discountAmount?: number;
  taxAmount?: number;
  subtotal?: number;
  totalAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  patientAge?: number;
  patientAddress?: string;
  doctorRegNumber?: string;
}

const SCHEDULED_DRUGS: DrugSchedule[] = ['H', 'H1', 'X'];

async function getNextBillNumber(tenantId: string): Promise<string> {
  const count = await prisma.bill.count({ where: { tenantId } });
  return `INV${String(count + 1).padStart(6, '0')}`;
}

export async function listBills(tenantId: string, query: Record<string, string | undefined>) {
  const page = Number(query['page'] ?? 1);
  const limit = Math.min(Number(query['limit'] ?? 50), 100);
  const skip = (page - 1) * limit;

  const where: Prisma.BillWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query['status'] ? { status: query['status'] as BillStatus } : {}),
    ...(query['search']
      ? {
          OR: [
            { billNumber: { contains: query['search'], mode: 'insensitive' } },
            { customerName: { contains: query['search'], mode: 'insensitive' } },
            { customerPhone: { contains: query['search'] } },
          ],
        }
      : {}),
  };

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({ where, skip, take: limit, include: { items: true }, orderBy: { createdAt: 'desc' } }),
    prisma.bill.count({ where }),
  ]);

  return paginate(bills, total, page, limit);
}

export async function getBillById(tenantId: string, id: string) {
  const bill = await prisma.bill.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { items: true },
  });
  if (!bill) throw new AppError('Bill not found', 404);
  return bill;
}

export async function createBill(tenantId: string, input: CreateBillInput, userId: string, userName: string) {
  if (!input.items || input.items.length === 0) throw new AppError('Bill must have at least one item', 422);

  // Schedule H/H1/X compliance (Drugs & Cosmetics Act): scheduled drugs can only
  // be dispensed against a prescription with patient and doctor details recorded.
  const medicines = await prisma.medicine.findMany({
    where: { id: { in: input.items.map(i => i.medicineId) }, tenantId },
    select: { id: true, name: true, schedule: true },
  });
  const scheduleById = new Map(medicines.map(m => [m.id, m.schedule]));
  const scheduledItems = input.items.filter(i => {
    const s = scheduleById.get(i.medicineId);
    return s !== null && s !== undefined && SCHEDULED_DRUGS.includes(s);
  });

  if (scheduledItems.length > 0) {
    const names = scheduledItems.map(i => i.medicineName).join(', ');
    if (!input.customer?.name?.trim()) {
      throw new AppError(`Patient name is required to dispense Schedule H/H1/X drugs: ${names}`, 422);
    }
    if (!input.doctor?.trim()) {
      throw new AppError(`Prescribing doctor name is required to dispense Schedule H/H1/X drugs: ${names}`, 422);
    }
  }

  const billNumber = await getNextBillNumber(tenantId);

  const bill = await prisma.$transaction(async tx => {
    const newBill = await tx.bill.create({
      data: {
        tenantId,
        billNumber,
        type: (input.type as Prisma.EnumBillTypeFilter['equals']) ?? 'sale',
        status: 'completed',
        customerName: input.customer?.name,
        customerPhone: input.customer?.phone,
        customerEmail: input.customer?.email,
        customerId: input.customer?.id,
        doctor: input.doctor,
        prescriptionId: input.prescriptionId,
        subtotal: input.subtotal ?? 0,
        discountAmount: input.discountAmount ?? 0,
        discountPercent: input.discountPercent ?? 0,
        taxAmount: input.taxAmount ?? 0,
        totalAmount: input.totalAmount ?? 0,
        paidAmount: input.paidAmount ?? input.totalAmount ?? 0,
        balanceAmount: (input.totalAmount ?? 0) - (input.paidAmount ?? input.totalAmount ?? 0),
        paymentMethod: (input.paymentMethod as PaymentMethod) ?? 'cash',
        notes: input.notes,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    for (const item of input.items) {
      const createdItem = await tx.billItem.create({
        data: {
          billId: newBill.id,
          medicineId: item.medicineId,
          inventoryItemId: item.inventoryItemId,
          medicineName: item.medicineName,
          genericName: item.genericName ?? '',
          batchNumber: item.batchNumber,
          expiryDate: new Date(item.expiryDate),
          quantity: item.quantity,
          mrp: item.mrp,
          sellingPrice: item.sellingPrice,
          discount: item.discount ?? 0,
          gstRate: item.gstRate ?? 0,
          gstAmount: item.gstAmount ?? 0,
          totalAmount: item.totalAmount,
        },
      });

      // Schedule drug register entry (statutory dispensing record)
      const schedule = scheduleById.get(item.medicineId);
      if (schedule && SCHEDULED_DRUGS.includes(schedule)) {
        await tx.scheduleDrugRegister.create({
          data: {
            tenantId,
            billId: newBill.id,
            billNumber,
            billItemId: createdItem.id,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            schedule,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            quantity: item.quantity,
            patientName: input.customer!.name,
            patientAge: input.patientAge,
            patientAddress: input.patientAddress,
            patientPhone: input.customer?.phone,
            doctorName: input.doctor!,
            doctorRegNumber: input.doctorRegNumber,
            dispensedBy: userId,
            dispensedByName: userName,
          },
        });
      }

      // Deduct inventory
      if (item.inventoryItemId) {
        const inv = await tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
        if (inv) {
          const newQty = Math.max(0, inv.quantity - item.quantity);
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: {
              quantity: newQty,
              status: newQty === 0 ? 'out_of_stock' : newQty <= (await tx.medicine.findUnique({ where: { id: inv.medicineId } }))!.reorderLevel ? 'low_stock' : 'available',
              batchStatus: newQty === 0 ? 'exhausted' : inv.batchStatus,
            },
          });

          await tx.stockMovement.create({
            data: {
              tenantId,
              medicineId: item.medicineId,
              inventoryItemId: item.inventoryItemId,
              movementType: 'SALE',
              quantity: item.quantity,
              previousQty: inv.quantity,
              newQty,
              referenceId: newBill.id,
              referenceType: 'bill',
              createdBy: userId,
            },
          });
        }
      }
    }

    // Update customer stats
    if (input.customer?.id) {
      await tx.customer.update({
        where: { id: input.customer.id },
        data: {
          totalPurchases: { increment: 1 },
          totalSpend: { increment: input.totalAmount ?? 0 },
          loyaltyPoints: { increment: Math.floor((input.totalAmount ?? 0) / 100) },
          lastVisitDate: new Date(),
          totalVisits: { increment: 1 },
        },
      });
    }

    return newBill;
  });

  const created = await prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });

  await createAuditLog({
    tenantId, userId, userName, module: 'billing', action: 'create',
    entityId: bill.id, entityName: billNumber,
    description: `Created bill ${billNumber} — ₹${input.totalAmount ?? 0}`,
  });

  return created;
}
