import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

// Auto-reorder engine: reconcile the reorder queue with live stock so medicines
// that have fallen to/below their reorder level appear automatically, and those
// replenished above it drop off (Vinay P14.2). Only PENDING (auto) rows are
// touched — manually 'ordered'/'received' rows are preserved.
async function syncReorderQueue(tenantId: string): Promise<void> {
  const now = new Date();
  const [medicines, items, existing] = await Promise.all([
    prisma.medicine.findMany({ where: { tenantId, deletedAt: null, status: 'active' }, select: { id: true, name: true, genericName: true, reorderLevel: true } }),
    prisma.inventoryItem.findMany({ where: { tenantId, deletedAt: null, batchStatus: 'active', expiryDate: { gt: now } }, select: { medicineId: true, quantity: true, reservedQuantity: true, purchasePrice: true } }),
    prisma.reorderItem.findMany({ where: { tenantId } }),
  ]);
  const stockByMed = new Map<string, { avail: number; lastPP: number }>();
  for (const it of items) {
    const cur = stockByMed.get(it.medicineId) ?? { avail: 0, lastPP: 0 };
    cur.avail += (it.quantity - it.reservedQuantity);
    if (it.purchasePrice) cur.lastPP = Number(it.purchasePrice);
    stockByMed.set(it.medicineId, cur);
  }
  const existingByMed = new Map(existing.map((e) => [e.medicineId, e]));
  const ops: Promise<unknown>[] = [];
  for (const m of medicines) {
    const s = stockByMed.get(m.id) ?? { avail: 0, lastPP: 0 };
    const level = m.reorderLevel || 10;
    const row = existingByMed.get(m.id);
    if (s.avail <= level) {
      const suggestedQty = Math.max(level, level * 2 - s.avail);
      const priority = s.avail <= 0 ? 'critical' : s.avail <= level * 0.4 ? 'high' : 'medium';
      if (!row) {
        ops.push(prisma.reorderItem.create({ data: { tenantId, medicineId: m.id, medicineName: m.name, genericName: m.genericName, currentStock: s.avail, reorderLevel: level, suggestedQty, priority, lastPurchasePrice: s.lastPP, status: 'pending' } }));
      } else if (row.status === 'pending') {
        ops.push(prisma.reorderItem.update({ where: { id: row.id }, data: { currentStock: s.avail, reorderLevel: level, suggestedQty, priority, lastPurchasePrice: s.lastPP || row.lastPurchasePrice } }));
      }
    } else if (row && row.status === 'pending') {
      // Replenished above threshold — remove the auto suggestion.
      ops.push(prisma.reorderItem.delete({ where: { id: row.id } }));
    }
  }
  if (ops.length) await Promise.allSettled(ops);
}

router.get('/stats', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    await syncReorderQueue(tenantId);
    const [totalPending, criticalItems, highPriorityItems, orderedToday, outOfStock, totalAlerts] = await Promise.all([
      prisma.reorderItem.count({ where: { tenantId, status: 'pending' } }),
      prisma.reorderItem.count({ where: { tenantId, priority: 'critical', status: 'pending' } }),
      prisma.reorderItem.count({ where: { tenantId, priority: 'high', status: 'pending' } }),
      prisma.reorderItem.count({ where: { tenantId, status: 'ordered', updatedAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
      prisma.reorderItem.count({ where: { tenantId, currentStock: 0 } }),
      prisma.reorderAlert.count({ where: { tenantId } }),
    ]);
    sendSuccess(res, { totalPending, criticalItems, highPriorityItems, orderedToday, outOfStock, totalAlerts, avgLeadTimeDays: 2 });
  } catch (err) { next(err); }
});

router.get('/alerts', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const { acknowledged } = req.query as Record<string, string>;
    const alerts = await prisma.reorderAlert.findMany({
      where: { tenantId, ...(acknowledged === 'false' ? { isAcknowledged: false } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, { data: alerts, total: alerts.length });
  } catch (err) { next(err); }
});

router.patch('/alerts/:id/acknowledge', requirePermission('inventory', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Tenant-scoped write — a cross-tenant id matches 0 rows → 404, not an IDOR.
    const result = await prisma.reorderAlert.updateMany({
      where: { id: req.params['id'], tenantId: t(req) },
      data: { isAcknowledged: true },
    });
    if (result.count === 0) { sendError(res, 'Alert not found', 404); return; }
    sendSuccess(res, null, 'Alert acknowledged');
  } catch (err) { next(err); }
});

router.get('/', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    await syncReorderQueue(tenantId);
    const { priority, status } = req.query as Record<string, string>;
    const items = await prisma.reorderItem.findMany({
      where: { tenantId, ...(priority ? { priority: priority as 'critical' | 'high' | 'medium' | 'low' } : {}), ...(status ? { status: status as 'pending' | 'ordered' | 'received' | 'cancelled' } : {}) },
      include: { vendorSuggestions: true },
      orderBy: [{ priority: 'asc' }, { daysStockLeft: 'asc' }],
    });
    sendSuccess(res, { data: items, total: items.length });
  } catch (err) { next(err); }
});

router.patch('/:id', requirePermission('inventory', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Ownership guard: reject a reorder item that is not in the caller's tenant.
    const existing = await prisma.reorderItem.findFirst({ where: { id: req.params['id'], tenantId: t(req) } });
    if (!existing) { sendError(res, 'Reorder item not found', 404); return; }
    // Whitelist the editable fields — never spread the raw body (mass-assignment).
    const body = req.body as Record<string, unknown>;
    const data: Prisma.ReorderItemUpdateInput = { updatedAt: new Date() };
    if (body['reorderLevel'] !== undefined) data.reorderLevel = Number(body['reorderLevel']);
    if (body['suggestedQty'] !== undefined) data.suggestedQty = Number(body['suggestedQty']);
    if (typeof body['priority'] === 'string') data.priority = body['priority'] as Prisma.ReorderItemUpdateInput['priority'];
    if (typeof body['status'] === 'string') data.status = body['status'] as Prisma.ReorderItemUpdateInput['status'];
    if (body['preferredVendor'] !== undefined) data.preferredVendor = body['preferredVendor'] === null ? null : String(body['preferredVendor']);
    if (body['notes'] !== undefined) data.notes = body['notes'] === null ? null : String(body['notes']);
    const item = await prisma.reorderItem.update({ where: { id: existing.id }, data });
    sendSuccess(res, item);
  } catch (err) { next(err); }
});

export default router;
