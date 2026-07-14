import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
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

router.get('/alerts', async (req: AuthRequest, res: Response, next: NextFunction) => {
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

router.patch('/alerts/:id/acknowledge', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.reorderAlert.update({ where: { id: req.params['id'] }, data: { isAcknowledged: true } });
    sendSuccess(res, null, 'Alert acknowledged');
  } catch (err) { next(err); }
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const { priority, status } = req.query as Record<string, string>;
    const items = await prisma.reorderItem.findMany({
      where: { tenantId, ...(priority ? { priority: priority as 'critical' | 'high' | 'medium' | 'low' } : {}), ...(status ? { status: status as 'pending' | 'ordered' | 'received' | 'cancelled' } : {}) },
      include: { vendorSuggestions: true },
      orderBy: [{ priority: 'asc' }, { daysStockLeft: 'asc' }],
    });
    sendSuccess(res, { data: items, total: items.length });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.reorderItem.update({ where: { id: req.params['id'] }, data: { ...req.body, updatedAt: new Date() } });
    sendSuccess(res, item);
  } catch (err) { next(err); }
});

export default router;
