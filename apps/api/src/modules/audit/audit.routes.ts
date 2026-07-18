import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess, paginate } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { Prisma, AuditModule, AuditAction, AuditSeverity } from '@prisma/client';

const router = Router();
router.use(authenticate);

// The audit trail, sessions and security events are administrative oversight —
// restricted to roles that can view settings (Pharma Admin).
router.use(requirePermission('settings', 'view'));

const t = (req: AuthRequest) => req.user!.tenantId;

router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalLogsToday, criticalActions, failedActions, totalSessions] = await Promise.all([
      prisma.auditLog.count({ where: { tenantId, createdAt: { gte: today } } }),
      prisma.auditLog.count({ where: { tenantId, severity: 'critical', createdAt: { gte: today } } }),
      prisma.auditLog.count({ where: { tenantId, status: 'failed', createdAt: { gte: today } } }),
      prisma.userSession.count({ where: { tenantId } }),
    ]);
    const activeUsers = await prisma.userSession.count({ where: { tenantId, isActive: true } });
    sendSuccess(res, { totalLogsToday, criticalActions, failedActions, activeUsers, sensitiveActionsToday: criticalActions, totalSessions });
  } catch (err) { next(err); }
});

router.get('/sessions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.userSession.findMany({ where: { tenantId: t(req) }, orderBy: { loginAt: 'desc' }, take: 50 });
    sendSuccess(res, { data: sessions, total: sessions.length });
  } catch (err) { next(err); }
});

router.get('/security-events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.securityEvent.findMany({ where: { tenantId: t(req) }, orderBy: { createdAt: 'desc' }, take: 50 });
    sendSuccess(res, { data: events, total: events.length });
  } catch (err) { next(err); }
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const { module, action, userId, severity, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(module ? { module: module as AuditModule } : {}),
      ...(action ? { action: action as AuditAction } : {}),
      ...(userId ? { userId } : {}),
      ...(severity ? { severity: severity as AuditSeverity } : {}),
      ...(search ? { OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { entityName: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    sendSuccess(res, paginate(logs, total, pageNum, limitNum));
  } catch (err) { next(err); }
});

export default router;
