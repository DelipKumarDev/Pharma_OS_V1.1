import { Router } from 'express';
import type { NextFunction, Response } from 'express';
import { Prisma, DrugSchedule } from '@prisma/client';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import type { AuthRequest } from '../../middleware/authenticate';
import { sendSuccess, paginate } from '../../utils/response';
import { toCsv, sendCsv } from '../../utils/csv';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const VALID_SCHEDULES: DrugSchedule[] = ['H', 'H1', 'X', 'G', 'C', 'E'];

function buildWhere(tenantId: string, query: Record<string, string | undefined>): Prisma.ScheduleDrugRegisterWhereInput {
  const schedule = query['schedule'];
  if (schedule && !VALID_SCHEDULES.includes(schedule as DrugSchedule)) {
    throw new AppError(`Invalid schedule. Valid values: ${VALID_SCHEDULES.join(', ')}`, 400);
  }
  return {
    tenantId,
    ...(schedule ? { schedule: schedule as DrugSchedule } : {}),
    ...(query['from'] ? { dispensedAt: { gte: new Date(query['from']) } } : {}),
    ...(query['to'] ? { dispensedAt: { lte: new Date(`${query['to']}T23:59:59.999Z`) } } : {}),
    ...(query['search']
      ? {
          OR: [
            { medicineName: { contains: query['search'], mode: 'insensitive' as const } },
            { patientName: { contains: query['search'], mode: 'insensitive' as const } },
            { doctorName: { contains: query['search'], mode: 'insensitive' as const } },
            { billNumber: { contains: query['search'], mode: 'insensitive' as const } },
            { batchNumber: { contains: query['search'], mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

// GET /api/schedule-register/stats
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, thisMonth, byScheduleRaw] = await Promise.all([
      prisma.scheduleDrugRegister.count({ where: { tenantId } }),
      prisma.scheduleDrugRegister.count({ where: { tenantId, dispensedAt: { gte: startOfMonth } } }),
      prisma.scheduleDrugRegister.groupBy({
        by: ['schedule'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    const bySchedule = Object.fromEntries(byScheduleRaw.map(r => [r.schedule, r._count._all]));
    sendSuccess(res, { total, thisMonth, bySchedule });
  } catch (err) { next(err); }
});

// GET /api/schedule-register/export — statutory register as CSV
router.get('/export', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const where = buildWhere(tenantId, req.query as Record<string, string | undefined>);
    const entries = await prisma.scheduleDrugRegister.findMany({
      where,
      orderBy: { dispensedAt: 'asc' },
      take: 10000,
    });

    let serial = 0;
    const csv = toCsv(entries, [
      { header: 'S.No', value: () => ++serial },
      { header: 'Date', value: r => r.dispensedAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) },
      { header: 'Bill No', value: r => r.billNumber },
      { header: 'Medicine', value: r => r.medicineName },
      { header: 'Schedule', value: r => r.schedule },
      { header: 'Batch No', value: r => r.batchNumber },
      { header: 'Qty', value: r => r.quantity },
      { header: 'Patient Name', value: r => r.patientName },
      { header: 'Patient Age', value: r => r.patientAge },
      { header: 'Patient Address', value: r => r.patientAddress },
      { header: 'Patient Phone', value: r => r.patientPhone },
      { header: 'Doctor Name', value: r => r.doctorName },
      { header: 'Doctor Reg No', value: r => r.doctorRegNumber },
      { header: 'Dispensed By', value: r => r.dispensedByName },
    ]);

    sendCsv(res, `schedule-register-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (err) { next(err); }
});

// GET /api/schedule-register — paginated list
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const query = req.query as Record<string, string | undefined>;
    const page = Number(query['page'] ?? 1);
    const limit = Math.min(Number(query['limit'] ?? 50), 100);
    const where = buildWhere(tenantId, query);

    const [entries, total] = await Promise.all([
      prisma.scheduleDrugRegister.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dispensedAt: 'desc' },
      }),
      prisma.scheduleDrugRegister.count({ where }),
    ]);

    sendSuccess(res, paginate(entries, total, page, limit));
  } catch (err) { next(err); }
});

export default router;
