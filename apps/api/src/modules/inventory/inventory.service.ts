import { Prisma, InventoryStatus, ExpiryStatus, BatchStatus, MovementType, AdjustmentType } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../utils/audit';
import { paginate } from '../../utils/response';

interface ListInventoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  expiryStatus?: string;
  category?: string;
  dosageForm?: string;
}

function computeExpiryStatus(expiryDate: Date, alertDays: number): ExpiryStatus {
  const now = new Date();
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= alertDays) return 'expiring_soon';
  return 'good';
}

function computeInventoryStatus(qty: number, reorderLevel: number): InventoryStatus {
  if (qty <= 0) return 'out_of_stock';
  if (qty <= reorderLevel) return 'low_stock';
  return 'available';
}

export async function getInventoryStats(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const alertDays = tenant?.expiryAlertDays ?? 90;
  const threshold = tenant?.lowStockThreshold ?? 10;

  const [allItems, medicines] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { tenantId, deletedAt: null, batchStatus: 'active' },
      include: { medicine: true },
    }),
    prisma.medicine.count({ where: { tenantId, deletedAt: null, status: 'active' } }),
  ]);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + alertDays * 24 * 60 * 60 * 1000);

  let inventoryValue = 0;
  let expiringSoonCount = 0;

  // "Low stock" / "below reorder level" is a PER-MEDICINE judgement: sum the
  // available quantity across a medicine's active batches, then compare to THAT
  // medicine's own reorderLevel (not a flat tenant threshold). This is the single
  // definition the dashboard KPI, Stock page header and Overview all share, so
  // the numbers always agree. `threshold` is only a fallback when a medicine has
  // no reorder level set.
  const medicineStockMap = new Map<string, { available: number; reorderLevel: number }>();
  for (const item of allItems) {
    const available = item.quantity - item.reservedQuantity;
    inventoryValue += available * Number(item.purchasePrice);
    const entry = medicineStockMap.get(item.medicineId)
      ?? { available: 0, reorderLevel: item.medicine.reorderLevel || threshold };
    entry.available += available;
    medicineStockMap.set(item.medicineId, entry);
    if (item.expiryDate <= now) {
      // expired
    } else if (item.expiryDate <= thirtyDaysFromNow) {
      expiringSoonCount++;
    }
  }

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let goodStockCount = 0;
  for (const [, s] of medicineStockMap) {
    if (s.available <= 0) outOfStockCount++;
    else if (s.available <= s.reorderLevel) lowStockCount++;
    else goodStockCount++;
  }

  return {
    totalMedicines: medicines,
    inventoryValue,
    lowStockCount,
    expiringSoonCount,
    outOfStockCount,
    goodStockCount,
    pendingTransfers: 0,
  };
}

export async function getAiInsights(tenantId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { tenantId, deletedAt: null },
    include: { medicine: true },
    orderBy: { quantity: 'asc' },
  });

  const criticalStock = items.filter(i => i.quantity <= 10).slice(0, 3);
  const expiringSoon = items.filter(i => {
    const days = (i.expiryDate.getTime() - Date.now()) / 86400000;
    return days > 0 && days <= 30;
  }).slice(0, 3);

  return {
    criticalStock: criticalStock.map(i => ({
      medicine: i.medicine.name,
      stock: i.quantity,
      action: 'Order immediately',
    })),
    expiringSoon: expiringSoon.map(i => ({
      medicine: i.medicine.name,
      expiryDate: i.expiryDate,
      qty: i.quantity,
      action: 'Discount and clear',
    })),
    insights: [
      { type: 'low_stock', count: criticalStock.length, message: `${criticalStock.length} medicines critically low` },
      { type: 'expiry', count: expiringSoon.length, message: `${expiringSoon.length} batches expiring within 30 days` },
    ],
  };
}

export async function listInventory(tenantId: string, query: ListInventoryQuery) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 1000);
  const skip = (page - 1) * limit;

  const where: Prisma.InventoryItemWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status as InventoryStatus } : {}),
    // "In Stock" must mean available AND not expired — expired batches belong only
    // under the Expiry filter, never in the In-Stock list (Vinay P6.2).
    ...(query.status === 'available' ? { expiryDate: { gt: new Date() } } : {}),
    ...(query.expiryStatus ? { expiryStatus: query.expiryStatus as ExpiryStatus } : {}),
    ...(query.category ? { medicine: { category: query.category as Prisma.EnumMedicineCategoryFilter } } : {}),
    ...(query.dosageForm ? { medicine: { form: query.dosageForm as Prisma.EnumMedicineFormFilter } } : {}),
    ...(query.search
      ? {
          OR: [
            { medicine: { name: { contains: query.search, mode: 'insensitive' } } },
            { batchNumber: { contains: query.search, mode: 'insensitive' } },
            { medicine: { manufacturer: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      skip,
      take: limit,
      include: { medicine: true },
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  const mapped = items.map(item => ({
    id: item.id,
    tenantId: item.tenantId,
    medicineId: item.medicineId,
    medicineName: item.medicine.name,
    genericName: item.medicine.genericName,
    manufacturer: item.medicine.manufacturer,
    category: item.medicine.category,
    dosageForm: item.medicine.form,
    strength: item.medicine.strength,
    batchNumber: item.batchNumber,
    quantity: item.quantity,
    reservedQuantity: item.reservedQuantity,
    availableQuantity: item.quantity - item.reservedQuantity,
    looseUnits: item.looseUnits,
    unitsPerPack: item.medicine.unitsPerPack,
    // Total sellable loose units across whole packs + already-opened loose units.
    availableUnits: (item.quantity - item.reservedQuantity) * item.medicine.unitsPerPack + item.looseUnits,
    purchasePrice: item.purchasePrice,
    mrp: item.mrp,
    sellingPrice: item.sellingPrice,
    manufacturingDate: item.manufacturingDate,
    expiryDate: item.expiryDate,
    supplierId: item.supplierId,
    purchaseOrderId: item.purchaseOrderId,
    rackNumber: item.rackNumber,
    rackLocation: item.rackLocation,
    reorderLevel: item.medicine.reorderLevel,
    status: item.status,
    expiryStatus: item.expiryStatus,
    batchStatus: item.batchStatus,
  }));

  return paginate(mapped, total, page, limit);
}

export async function getBatchesByMedicine(tenantId: string, medicineId: string) {
  return prisma.inventoryItem.findMany({
    where: { tenantId, medicineId, deletedAt: null },
    orderBy: { expiryDate: 'asc' },
  });
}

export async function getMovementsByMedicine(tenantId: string, medicineId: string) {
  return prisma.stockMovement.findMany({
    where: { tenantId, medicineId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function createInventoryItem(tenantId: string, input: Record<string, unknown>, userId: string, userName: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const alertDays = tenant?.expiryAlertDays ?? 90;

  const expiryDate = new Date(input['expiryDate'] as string);
  const qty = Number(input['quantity'] ?? 0);
  const medicine = await prisma.medicine.findFirst({ where: { id: input['medicineId'] as string, tenantId } });
  if (!medicine) throw new AppError('Medicine not found', 404);

  // Guard against unsellable stock entering inventory (QA: never accept an
  // already-expired batch, a back-dated expiry, a zero/negative qty, or bad prices).
  const now = new Date();
  if (isNaN(expiryDate.getTime())) throw new AppError('A valid expiry date is required', 422);
  if (expiryDate <= now) throw new AppError('Cannot add stock that has already expired', 422);
  if (input['manufacturingDate']) {
    const mfg = new Date(input['manufacturingDate'] as string);
    if (!isNaN(mfg.getTime()) && expiryDate <= mfg) throw new AppError('Expiry must be after the manufacturing date', 422);
  }
  if (!Number.isFinite(qty) || qty < 1) throw new AppError('Quantity must be at least 1', 422);
  const nMrp = Number(input['mrp']), nSp = Number(input['sellingPrice']), nPp = Number(input['purchasePrice']);
  if ([nMrp, nSp, nPp].some(v => !Number.isFinite(v) || v < 0)) throw new AppError('Prices cannot be negative', 422);

  const expiryStatus = computeExpiryStatus(expiryDate, alertDays);
  const status = computeInventoryStatus(qty, medicine.reorderLevel);

  // Consolidate stock: if the SAME medicine + batch + expiry already exists, top
  // up that line instead of creating a duplicate entry (Vinay P8.3).
  const dup = await prisma.inventoryItem.findFirst({
    where: {
      tenantId, deletedAt: null,
      medicineId: input['medicineId'] as string,
      batchNumber: input['batchNumber'] as string,
      expiryDate,
    },
  });
  if (dup) {
    const newQty = dup.quantity + qty;
    const merged = await prisma.inventoryItem.update({
      where: { id: dup.id },
      data: {
        quantity: newQty,
        purchasePrice: nPp, mrp: nMrp, sellingPrice: nSp,
        status: computeInventoryStatus(newQty, medicine.reorderLevel),
        expiryStatus, batchStatus: 'active', updatedBy: userId,
      },
    });
    await prisma.stockMovement.create({
      data: {
        tenantId, medicineId: merged.medicineId, inventoryItemId: merged.id,
        movementType: 'PURCHASE', quantity: qty, previousQty: dup.quantity, newQty,
        referenceId: merged.id, referenceType: 'inventory_item',
        notes: `Stock topped up on existing batch ${merged.batchNumber}`, createdBy: userId,
      },
    });
    await createAuditLog({
      tenantId, userId, userName, module: 'inventory', action: 'update',
      entityId: merged.id, entityName: medicine.name,
      description: `Topped up batch ${merged.batchNumber} by ${qty} → ${newQty} units`,
    });
    return merged;
  }

  const item = await prisma.inventoryItem.create({
    data: {
      tenantId,
      medicineId: input['medicineId'] as string,
      batchNumber: input['batchNumber'] as string,
      quantity: qty,
      reservedQuantity: 0,
      purchasePrice: input['purchasePrice'] as number,
      mrp: input['mrp'] as number,
      sellingPrice: input['sellingPrice'] as number,
      manufacturingDate: input['manufacturingDate'] ? new Date(input['manufacturingDate'] as string) : null,
      expiryDate,
      supplierId: input['supplierId'] as string | undefined,
      purchaseOrderId: input['purchaseOrderId'] as string | undefined,
      rackNumber: input['rackNumber'] as string | undefined,
      rackLocation: input['rackLocation'] as string | undefined,
      status,
      expiryStatus,
      batchStatus: 'active',
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await prisma.stockMovement.create({
    data: {
      tenantId,
      medicineId: item.medicineId,
      inventoryItemId: item.id,
      movementType: 'PURCHASE',
      quantity: qty,
      previousQty: 0,
      newQty: qty,
      referenceId: item.id,
      referenceType: 'inventory_item',
      notes: `Stock added: batch ${item.batchNumber}`,
      createdBy: userId,
    },
  });

  await createAuditLog({
    tenantId, userId, userName, module: 'inventory', action: 'create',
    entityId: item.id, entityName: medicine.name,
    description: `Added batch ${item.batchNumber} — ${qty} units`,
  });

  return item;
}

export async function updateInventoryStatus(tenantId: string, id: string, status: InventoryStatus, sellingPrice?: number) {
  const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw new AppError('Inventory item not found', 404);
  const data: Prisma.InventoryItemUpdateInput = { status };
  // Optional clearance-price update (e.g. near-expiry discount).
  if (sellingPrice !== undefined && sellingPrice !== null && !isNaN(Number(sellingPrice)) && Number(sellingPrice) >= 0) {
    data.sellingPrice = Number(sellingPrice);
  }
  return prisma.inventoryItem.update({ where: { id }, data });
}

// Edit a stock entry's correctable fields — batch, expiry, prices, rack (Vinay
// P6.3). Quantity is intentionally NOT edited here (use Adjust Stock so every
// quantity change is audited via a stock movement).
export async function editInventoryItem(tenantId: string, id: string, input: Record<string, unknown>, userId: string, userName: string) {
  const item = await prisma.inventoryItem.findFirst({ where: { id, tenantId, deletedAt: null }, include: { medicine: true } });
  if (!item) throw new AppError('Inventory item not found', 404);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const alertDays = tenant?.expiryAlertDays ?? 90;

  const data: Prisma.InventoryItemUpdateInput = { updatedBy: userId };
  if (typeof input['batchNumber'] === 'string' && input['batchNumber'].trim()) data.batchNumber = input['batchNumber'].trim();
  if (input['expiryDate']) {
    const e = new Date(input['expiryDate'] as string);
    if (isNaN(e.getTime())) throw new AppError('Invalid expiry date', 422);
    data.expiryDate = e;
    data.expiryStatus = computeExpiryStatus(e, alertDays);
  }
  for (const f of ['mrp', 'sellingPrice', 'purchasePrice'] as const) {
    if (input[f] !== undefined && input[f] !== null && input[f] !== '') {
      const n = Number(input[f]);
      if (!Number.isFinite(n) || n < 0) throw new AppError(`${f} must be a non-negative number`, 422);
      data[f] = n;
    }
  }
  if (input['rackLocation'] !== undefined) data.rackLocation = String(input['rackLocation']);

  const updated = await prisma.inventoryItem.update({ where: { id }, data });
  await createAuditLog({
    tenantId, userId, userName, module: 'inventory', action: 'update',
    entityId: id, entityName: item.medicine.name,
    description: `Edited batch ${updated.batchNumber} details`,
  });
  return updated;
}

export async function adjustStock(
  tenantId: string,
  id: string,
  adjustmentType: AdjustmentType,
  quantity: number,
  notes: string,
  userId: string,
  userName: string,
) {
  const item = await prisma.inventoryItem.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!item) throw new AppError('Inventory item not found', 404);

  const addTypes: AdjustmentType[] = ['addition', 'return'];
  if (!Number.isFinite(quantity) || quantity < 1) throw new AppError('Adjustment quantity must be at least 1', 422);
  const isAdd = addTypes.includes(adjustmentType);
  const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } });

  // Atomic + race-safe: lock the batch row, re-validate against the *locked*
  // quantity, then write the new quantity and its stock movement in one
  // transaction. Without this, two concurrent adjustments (or an adjustment racing
  // a sale) read the same stale quantity and lose an update / drive stock negative,
  // and a movement-write failure could leave the quantity changed with no audit.
  const { updated, prevQty, newQty } = await prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<Array<{ quantity: number }>>`
      SELECT "quantity" FROM "inventory_items" WHERE "id" = ${id} FOR UPDATE`;
    const curQty = locked[0]?.quantity ?? item.quantity;
    // Never let a deduction/damage/correction drive stock below zero — surface it.
    if (!isAdd && quantity > curQty) {
      throw new AppError(`Cannot ${adjustmentType} ${quantity} — only ${curQty} in stock`, 422);
    }
    const nQty = isAdd ? curQty + quantity : curQty - quantity;
    const status = computeInventoryStatus(nQty, medicine?.reorderLevel ?? 10);

    const upd = await tx.inventoryItem.update({
      where: { id },
      data: {
        quantity: nQty,
        status,
        batchStatus: nQty === 0 ? 'exhausted' : item.batchStatus,
        updatedBy: userId,
      },
    });
    await tx.stockMovement.create({
      data: {
        tenantId,
        medicineId: item.medicineId,
        inventoryItemId: item.id,
        movementType: 'ADJUSTMENT',
        adjustmentType,
        quantity,
        previousQty: curQty,
        newQty: nQty,
        notes,
        createdBy: userId,
      },
    });
    return { updated: upd, prevQty: curQty, newQty: nQty };
  });

  await createAuditLog({
    tenantId, userId, userName, module: 'inventory', action: 'adjust',
    entityId: id, entityName: medicine?.name,
    description: `Stock adjustment: ${prevQty} → ${newQty} (${adjustmentType}) — ${notes}`,
    beforeValue: { qty: prevQty },
    afterValue: { qty: newQty },
    severity: 'warning',
  });

  return updated;
}

export async function deleteInventoryItem(tenantId: string, id: string, userId: string, userName: string) {
  const item = await prisma.inventoryItem.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!item) throw new AppError('Inventory item not found', 404);

  await prisma.inventoryItem.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: userId } });

  await createAuditLog({
    tenantId, userId, userName, module: 'inventory', action: 'delete',
    entityId: id, description: `Removed inventory batch ${item.batchNumber}`, severity: 'warning',
  });
}
