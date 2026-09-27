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
    saleUnit?: 'pack' | 'unit';
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

// Collision-free sequential bill number via a per-tenant atomic counter. The
// upsert-and-return is a single auto-committed statement: concurrent callers
// serialize on the counter row only for that instant (not across the billing
// transaction) and each receives a unique, increasing value — no retries.
async function getNextBillNumber(tenantId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ nextValue: number }>>`
    INSERT INTO "document_counters" ("tenantId", "docType", "nextValue")
    VALUES (${tenantId}, 'bill', 1)
    ON CONFLICT ("tenantId", "docType")
    DO UPDATE SET "nextValue" = "document_counters"."nextValue" + 1
    RETURNING "nextValue"`;
  const n = rows[0]?.nextValue ?? 1;
  return `INV${String(n).padStart(6, '0')}`;
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
    select: { id: true, name: true, schedule: true, unitsPerPack: true, reorderLevel: true },
  });
  const scheduleById = new Map(medicines.map(m => [m.id, m.schedule]));
  const medMetaById = new Map(medicines.map(m => [m.id, { unitsPerPack: m.unitsPerPack, reorderLevel: m.reorderLevel }]));
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

    const now = new Date();
    for (const item of input.items) {
      // Resolve the batch being dispensed. A medicine can only be billed if it
      // has live, non-expired stock in inventory (TC_029/TC_030). Prefer the
      // explicit batch sent by the POS; otherwise pick the earliest-expiring
      // non-expired batch (FEFO).
      const inv = item.inventoryItemId
        ? await tx.inventoryItem.findFirst({ where: { id: item.inventoryItemId, tenantId, deletedAt: null } })
        : await tx.inventoryItem.findFirst({
            where: { tenantId, medicineId: item.medicineId, deletedAt: null, batchStatus: 'active', expiryDate: { gt: now }, quantity: { gt: 0 } },
            orderBy: { expiryDate: 'asc' },
          });

      if (!inv) {
        throw new AppError(`${item.medicineName} is not in stock — add stock in Stock & Inventory before billing.`, 422);
      }
      if (inv.expiryDate <= now) {
        throw new AppError(`${item.medicineName} (batch ${inv.batchNumber}) has expired and cannot be billed.`, 422);
      }
      // Lock this batch row for the rest of the transaction so concurrent sales
      // serialize on it: a second sale of the same batch waits for the first to
      // commit, then reads the *updated* quantity — no oversell/lost-update, and
      // legitimate back-to-back sales still succeed up to the real stock.
      const locked = await tx.$queryRaw<Array<{ quantity: number; reservedQuantity: number; looseUnits: number }>>`
        SELECT "quantity", "reservedQuantity", "looseUnits" FROM "inventory_items" WHERE "id" = ${inv.id} FOR UPDATE`;
      const curQty = locked[0]?.quantity ?? inv.quantity;
      const curReserved = locked[0]?.reservedQuantity ?? inv.reservedQuantity;
      const curLoose = locked[0]?.looseUnits ?? inv.looseUnits;

      // ── Resolve the sale unit and plan the stock deduction ──────────────────
      // A batch holds whole packs plus loose units from an opened pack. A line is
      // billed either by pack (strip) or by loose unit (tablet/capsule). Loose
      // sales are satisfied from existing loose units first, opening whole packs
      // as needed (FEFO already picked the batch).
      const meta = medMetaById.get(item.medicineId) ?? { unitsPerPack: 1, reorderLevel: 10 };
      const unitsPerPack = Math.max(1, meta.unitsPerPack || 1);
      const saleUnit: 'pack' | 'unit' = item.saleUnit === 'unit' && unitsPerPack > 1 ? 'unit' : 'pack';

      const availablePacks = curQty - curReserved;
      let newQty = curQty;
      let newLoose = curLoose;

      if (saleUnit === 'pack') {
        if (availablePacks < item.quantity) {
          throw new AppError(`Insufficient stock for ${item.medicineName}: ${availablePacks} pack(s) available, ${item.quantity} requested.`, 422);
        }
        newQty = curQty - item.quantity;
      } else {
        const totalUnits = availablePacks * unitsPerPack + curLoose;
        if (totalUnits < item.quantity) {
          throw new AppError(`Insufficient stock for ${item.medicineName}: ${totalUnits} unit(s) available, ${item.quantity} requested.`, 422);
        }
        let need = item.quantity;
        let loose = curLoose;
        let packs = curQty;
        if (loose >= need) {
          loose -= need;
        } else {
          need -= loose;
          const packsToOpen = Math.ceil(need / unitsPerPack);
          packs -= packsToOpen;
          loose = packsToOpen * unitsPerPack - need;
        }
        newQty = packs;
        newLoose = loose;
      }
      const packsRemoved = curQty - newQty;

      const createdItem = await tx.billItem.create({
        data: {
          billId: newBill.id,
          medicineId: item.medicineId,
          inventoryItemId: inv.id,
          medicineName: item.medicineName,
          genericName: item.genericName ?? '',
          batchNumber: inv.batchNumber,
          expiryDate: inv.expiryDate,
          quantity: item.quantity,
          saleUnit,
          unitsPerPack,
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
            batchNumber: inv.batchNumber,
            expiryDate: inv.expiryDate,
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

      // Deduct inventory from the resolved batch (packs + loose units)
      {
        const exhausted = newQty === 0 && newLoose === 0;
        await tx.inventoryItem.update({
          where: { id: inv.id },
          data: {
            quantity: newQty,
            looseUnits: newLoose,
            status: exhausted ? 'out_of_stock' : newQty <= meta.reorderLevel ? 'low_stock' : 'available',
            batchStatus: exhausted ? 'exhausted' : inv.batchStatus,
          },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            medicineId: item.medicineId,
            inventoryItemId: inv.id,
            movementType: 'SALE',
            quantity: packsRemoved,
            previousQty: curQty,
            newQty,
            referenceId: newBill.id,
            referenceType: 'bill',
            notes: saleUnit === 'unit' ? `Loose sale: ${item.quantity} unit(s) @ ${unitsPerPack}/pack` : undefined,
            createdBy: userId,
          },
        });
      }
    }

    // Update customer stats. An unpaid balance (credit/part-paid sale) is added
    // to the customer's outstanding credit so Credit Accounts stays accurate and
    // the amount is collectable later.
    if (input.customer?.id) {
      const outstanding = Number(((input.totalAmount ?? 0) - (input.paidAmount ?? input.totalAmount ?? 0)).toFixed(2));
      await tx.customer.update({
        where: { id: input.customer.id },
        data: {
          totalPurchases: { increment: 1 },
          totalSpend: { increment: input.totalAmount ?? 0 },
          loyaltyPoints: { increment: Math.floor((input.totalAmount ?? 0) / 100) },
          lastVisitDate: new Date(),
          totalVisits: { increment: 1 },
          ...(outstanding > 0 ? { creditBalance: { increment: outstanding } } : {}),
        },
      });
    }

    return newBill;
  }, {
    // Generous limits so that under heavy same-batch contention (many tills selling
    // the same batch at once) transactions wait for the row lock/connection instead
    // of aborting — the batch row lock still guarantees no oversell.
    timeout: 20_000,
    maxWait: 15_000,
  });

  const created = await prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });

  await createAuditLog({
    tenantId, userId, userName, module: 'billing', action: 'create',
    entityId: bill.id, entityName: billNumber,
    description: `Created bill ${billNumber} — ₹${input.totalAmount ?? 0}`,
  });

  return created;
}
