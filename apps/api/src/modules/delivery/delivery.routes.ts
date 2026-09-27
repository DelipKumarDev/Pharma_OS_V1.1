import { Router } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);
const t = (req: AuthRequest) => req.user!.tenantId;

async function nextNumber(tenantId: string): Promise<string> {
  const n = await prisma.deliveryOrder.count({ where: { tenantId } });
  return `DEL${String(n + 1).padStart(5, '0')}`;
}

router.get('/', requirePermission('billing', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as Record<string, string>;
    const data = await prisma.deliveryOrder.findMany({
      where: { tenantId: t(req), ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, { data, total: data.length });
  } catch (err) { next(err); }
});

router.get('/stats', requirePermission('billing', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const [pending, out, delivered] = await Promise.all([
      prisma.deliveryOrder.count({ where: { tenantId, status: 'pending' } }),
      prisma.deliveryOrder.count({ where: { tenantId, status: 'out_for_delivery' } }),
      prisma.deliveryOrder.count({ where: { tenantId, status: 'delivered' } }),
    ]);
    sendSuccess(res, { pending, out, delivered });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('billing', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = req.body as { billId?: string; billNumber?: string; customerName?: string; customerPhone?: string; address?: string; notes?: string; assignedTo?: string };
    if (!b.customerName?.trim()) throw new AppError('Customer name is required', 422);
    if (!b.address?.trim()) throw new AppError('Delivery address is required', 422);
    const order = await prisma.deliveryOrder.create({
      data: {
        tenantId: t(req), orderNumber: await nextNumber(t(req)),
        billId: b.billId, billNumber: b.billNumber, customerName: b.customerName,
        customerPhone: b.customerPhone, address: b.address, notes: b.notes, assignedTo: b.assignedTo,
        createdBy: req.user!.sub,
      },
    });
    sendSuccess(res, order, 'Delivery order created', 201);
  } catch (err) { next(err); }
});

router.patch('/:id/status', requirePermission('billing', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: string };
    const valid = ['pending', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(status)) throw new AppError('Invalid status', 422);
    const existing = await prisma.deliveryOrder.findFirst({ where: { id: req.params['id'], tenantId: t(req) } });
    if (!existing) throw new AppError('Delivery order not found', 404);
    const order = await prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: { status: status as never, deliveredAt: status === 'delivered' ? new Date() : existing.deliveredAt },
    });
    sendSuccess(res, order, 'Delivery status updated');
  } catch (err) { next(err); }
});

export default router;
