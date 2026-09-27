import { Router } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { createInventoryItem } from '../inventory/inventory.service';
import { createAuditLog } from '../../utils/audit';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

interface POItemInput { medicineId: string; medicineName?: string; quantity: number; unitCost: number; gstRate?: number }

async function nextPoNumber(tenantId: string): Promise<string> {
  const count = await prisma.purchaseOrder.count({ where: { tenantId } });
  return `PO${String(count + 1).padStart(5, '0')}`;
}

// ── List POs ─────────────────────────────────────────────────────────────────
router.get('/', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as Record<string, string>;
    const orders = await prisma.purchaseOrder.findMany({
      where: { tenantId: t(req), deletedAt: null, ...(status ? { status: status as never } : {}) },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, { data: orders, total: orders.length });
  } catch (err) { next(err); }
});

// ── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const [open, received, agg] = await Promise.all([
      prisma.purchaseOrder.count({ where: { tenantId, deletedAt: null, status: { in: ['ordered', 'partially_received'] } } }),
      prisma.purchaseOrder.count({ where: { tenantId, deletedAt: null, status: 'received' } }),
      prisma.purchaseOrder.aggregate({ where: { tenantId, deletedAt: null, status: { in: ['ordered', 'partially_received'] } }, _sum: { totalAmount: true } }),
    ]);
    sendSuccess(res, { open, received, openValue: agg._sum.totalAmount ?? 0 });
  } catch (err) { next(err); }
});

// ── Get one ──────────────────────────────────────────────────────────────────
router.get('/:id', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const po = await prisma.purchaseOrder.findFirst({ where: { id: req.params['id'], tenantId: t(req), deletedAt: null }, include: { items: true } });
    if (!po) throw new AppError('Purchase order not found', 404);
    sendSuccess(res, po);
  } catch (err) { next(err); }
});

// ── Create PO ────────────────────────────────────────────────────────────────
router.post('/', requirePermission('inventory', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const body = req.body as { vendorId: string; expectedDate?: string; notes?: string; items: POItemInput[] };
    if (!body.vendorId) throw new AppError('Vendor is required', 422);
    if (!Array.isArray(body.items) || body.items.length === 0) throw new AppError('Add at least one item', 422);

    const vendor = await prisma.vendor.findFirst({ where: { id: body.vendorId, tenantId, deletedAt: null } });
    if (!vendor) throw new AppError('Vendor not found', 404);

    const medIds = body.items.map(i => i.medicineId);
    const meds = await prisma.medicine.findMany({ where: { id: { in: medIds }, tenantId }, select: { id: true, name: true, gstRate: true } });
    const medMap = new Map(meds.map(m => [m.id, m]));

    let subtotal = 0, taxAmount = 0;
    const itemData = body.items.map(i => {
      const med = medMap.get(i.medicineId);
      if (!med) throw new AppError(`Medicine ${i.medicineId} not found`, 404);
      const qty = Number(i.quantity) || 0;
      const cost = Number(i.unitCost) || 0;
      if (qty <= 0) throw new AppError(`Quantity for ${med.name} must be at least 1`, 422);
      const line = qty * cost;
      const gstRate = i.gstRate ?? med.gstRate ?? 12;
      const gst = line * (gstRate / 100);
      subtotal += line; taxAmount += gst;
      return { medicineId: med.id, medicineName: med.name, quantity: qty, unitCost: cost, gstRate, totalAmount: Number((line + gst).toFixed(2)) };
    });

    const poNumber = await nextPoNumber(tenantId);
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId, vendorId: vendor.id, vendorName: vendor.name, poNumber,
        status: 'ordered',
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        notes: body.notes,
        subtotal: Number(subtotal.toFixed(2)), taxAmount: Number(taxAmount.toFixed(2)),
        totalAmount: Number((subtotal + taxAmount).toFixed(2)),
        createdBy: req.user!.sub, updatedBy: req.user!.sub,
        items: { create: itemData },
      },
      include: { items: true },
    });

    // Mark matching reorder items as ordered.
    await prisma.reorderItem.updateMany({ where: { tenantId, medicineId: { in: medIds }, status: 'pending' }, data: { status: 'ordered' } });
    await prisma.vendor.update({ where: { id: vendor.id }, data: { lastOrderDate: new Date() } });

    await createAuditLog({ tenantId, userId: req.user!.sub, userName: req.user!.name, module: 'reorder', action: 'create', description: `Created ${poNumber} for ${vendor.name} (₹${po.totalAmount})` });

    sendSuccess(res, po, 'Purchase order created', 201);
  } catch (err) { next(err); }
});

// ── Receive stock against a PO ───────────────────────────────────────────────
// Body: { items: [{ poItemId, batchNumber, expiryDate, quantity, mrp?, sellingPrice?, manufacturingDate?, rackLocation? }] }
router.post('/:id/receive', requirePermission('inventory', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const po = await prisma.purchaseOrder.findFirst({ where: { id: req.params['id'], tenantId, deletedAt: null }, include: { items: true } });
    if (!po) throw new AppError('Purchase order not found', 404);
    if (po.status === 'received') throw new AppError('This purchase order is already fully received', 422);
    if (po.status === 'cancelled') throw new AppError('Cannot receive a cancelled purchase order', 422);

    const rows = (req.body as { items?: Array<Record<string, unknown>> }).items;
    if (!Array.isArray(rows) || rows.length === 0) throw new AppError('No items to receive', 422);

    const itemById = new Map(po.items.map(i => [i.id, i]));
    let receivedCount = 0;

    for (const r of rows) {
      const poItem = itemById.get(String(r['poItemId']));
      if (!poItem) continue;
      const qty = Number(r['quantity']) || 0;
      if (qty <= 0) continue;
      const remaining = poItem.quantity - poItem.receivedQuantity;
      if (qty > remaining) throw new AppError(`Cannot receive ${qty} of ${poItem.medicineName} — only ${remaining} remaining on the PO`, 422);
      if (!r['batchNumber']) throw new AppError(`Batch number is required for ${poItem.medicineName}`, 422);
      if (!r['expiryDate']) throw new AppError(`Expiry date is required for ${poItem.medicineName}`, 422);
      if (new Date(String(r['expiryDate'])) <= new Date()) throw new AppError(`Expiry date for ${poItem.medicineName} must be in the future`, 422);

      const med = await prisma.medicine.findUnique({ where: { id: poItem.medicineId } });

      // Create the inventory batch (also records a stock movement).
      await createInventoryItem(tenantId, {
        medicineId: poItem.medicineId,
        batchNumber: String(r['batchNumber']),
        quantity: qty,
        purchasePrice: poItem.unitCost,
        mrp: r['mrp'] != null ? Number(r['mrp']) : (med?.mrp ?? poItem.unitCost),
        sellingPrice: r['sellingPrice'] != null ? Number(r['sellingPrice']) : (med?.sellingPrice ?? poItem.unitCost),
        manufacturingDate: r['manufacturingDate'] ?? undefined,
        expiryDate: String(r['expiryDate']),
        purchaseOrderId: po.id,
        supplierId: po.vendorId,
        rackLocation: r['rackLocation'] ?? undefined,
      }, req.user!.sub, req.user!.name);

      await prisma.purchaseOrderItem.update({ where: { id: poItem.id }, data: { receivedQuantity: poItem.receivedQuantity + qty } });
      receivedCount++;
    }

    // Recompute PO status from received quantities.
    const refreshed = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { items: true } });
    const allReceived = refreshed!.items.every(i => i.receivedQuantity >= i.quantity);
    const anyReceived = refreshed!.items.some(i => i.receivedQuantity > 0);
    const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : 'ordered';

    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: newStatus, receivedDate: allReceived ? new Date() : po.receivedDate, updatedBy: req.user!.sub },
      include: { items: true },
    });

    if (allReceived) {
      const medIds = refreshed!.items.map(i => i.medicineId);
      await prisma.reorderItem.updateMany({ where: { tenantId, medicineId: { in: medIds }, status: 'ordered' }, data: { status: 'received' } });
      await prisma.vendor.update({ where: { id: po.vendorId }, data: { totalPurchases: { increment: po.totalAmount } } });
    }

    await createAuditLog({ tenantId, userId: req.user!.sub, userName: req.user!.name, module: 'inventory', action: 'create', description: `Received ${receivedCount} item(s) against ${po.poNumber} — status ${newStatus}` });

    sendSuccess(res, updated, `Stock received against ${po.poNumber}`);
  } catch (err) { next(err); }
});

// ── Cancel PO ────────────────────────────────────────────────────────────────
router.patch('/:id/cancel', requirePermission('inventory', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const po = await prisma.purchaseOrder.findFirst({ where: { id: req.params['id'], tenantId, deletedAt: null } });
    if (!po) throw new AppError('Purchase order not found', 404);
    if (po.status === 'received') throw new AppError('Cannot cancel a fully received purchase order', 422);
    const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'cancelled', updatedBy: req.user!.sub } });
    sendSuccess(res, updated, 'Purchase order cancelled');
  } catch (err) { next(err); }
});

export default router;
