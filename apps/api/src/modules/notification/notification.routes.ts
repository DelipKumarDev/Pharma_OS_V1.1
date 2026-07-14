import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { Prisma, NotificationCategory } from '@prisma/client';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const [totalUnread, criticalUnread, warningUnread, infoUnread, todayTotal] = await Promise.all([
      prisma.notification.count({ where: { tenantId, isRead: false } }),
      prisma.notification.count({ where: { tenantId, isRead: false, priority: 'critical' } }),
      prisma.notification.count({ where: { tenantId, isRead: false, priority: 'warning' } }),
      prisma.notification.count({ where: { tenantId, isRead: false, priority: 'info' } }),
      prisma.notification.count({ where: { tenantId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    sendSuccess(res, { totalUnread, criticalUnread, warningUnread, infoUnread, todayTotal });
  } catch (err) { next(err); }
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const { category, unread, priority } = req.query as Record<string, string>;
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      ...(category ? { category: category as NotificationCategory } : {}),
      ...(unread === 'true' ? { isRead: false } : {}),
      ...(priority ? { priority: priority as Prisma.EnumNotificationPriorityFilter['equals'] } : {}),
    };
    const notifications = await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    sendSuccess(res, { data: notifications, total: notifications.length });
  } catch (err) { next(err); }
});

router.patch('/mark-all-read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { tenantId: t(req), isRead: false }, data: { isRead: true, readAt: new Date() } });
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.update({ where: { id: req.params['id'] }, data: { isRead: true, readAt: new Date() } });
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) { next(err); }
});

export default router;
