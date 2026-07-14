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
  let lowStockCount = 0;
  let expiringSoonCount = 0;
  let outOfStockCount = 0;

  const medicineStockMap = new Map<string, number>();
  for (const item of allItems) {
    const available = item.quantity - item.reservedQuantity;
    inventoryValue += available * item.purchasePrice;
    medicineStockMap.set(item.medicineId, (medicineStockMap.get(item.medicineId) ?? 0) + available);
    if (item.expiryDate <= now) {
      // expired
    } else if (item.expiryDate <= thirtyDaysFromNow) {
      expiringSoonCount++;
    }
  }

  for (const [, qty] of medicineStockMap) {
    if (qty <= 0) outOfStockCount++;
    else if (qty <= threshold) lowStockCount++;
  }

  return {
    totalMedicines: medicines,
    inventoryValue,
    lowStockCount,
    expiringSoonCount,
    outOfStockCount,
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
  const limit = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.InventoryItemWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status as InventoryStatus } : {}),
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
      orderBy: [{ expiryDate: 'asc' }],
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
  const qty = (input['quantity'] as number) ?? 0;
  const medicine = await prisma.medicine.findFirst({ where: { id: input['medicineId'] as string, tenantId } });
  if (!medicine) throw new AppError('Medicine not found', 404);

  const expiryStatus = computeExpiryStatus(expiryDate, alertDays);
  const status = computeInventoryStatus(qty, medicine.reorderLevel);

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

export async function updateInventoryStatus(tenantId: string, id: string, status: InventoryStatus) {
  const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw new AppError('Inventory item not found', 404);
  return prisma.inventoryItem.update({ where: { id }, data: { status } });
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
  const newQty = addTypes.includes(adjustmentType) ? item.quantity + quantity : Math.max(0, item.quantity - quantity);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } });
  const status = computeInventoryStatus(newQty, medicine?.reorderLevel ?? 10);

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      quantity: newQty,
      status,
      batchStatus: newQty === 0 ? 'exhausted' : item.batchStatus,
      updatedBy: userId,
    },
  });

  await prisma.stockMovement.create({
    data: {
      tenantId,
      medicineId: item.medicineId,
      inventoryItemId: item.id,
      movementType: 'ADJUSTMENT',
      adjustmentType,
      quantity,
      previousQty: item.quantity,
      newQty,
      notes,
      createdBy: userId,
    },
  });

  await createAuditLog({
    tenantId, userId, userName, module: 'inventory', action: 'adjust',
    entityId: id, entityName: medicine?.name,
    description: `Stock adjustment: ${item.quantity} → ${newQty} (${adjustmentType}) — ${notes}`,
    beforeValue: { qty: item.quantity },
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
