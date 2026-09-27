import { Router } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../utils/audit';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);
const t = (req: AuthRequest) => req.user!.tenantId;

// Business day is the pharmacy's local (India / IST, UTC+5:30) calendar day.
//  - `dayStr`      : the IST calendar date of a UTC instant (for grouping bills)
//  - `closeDateOf` : midnight-UTC Date for that plain date, so the @db.Date column
//                    stores exactly that calendar date (no timezone shift)
//  - `billWindow`  : the UTC instant range [00:00 IST, next 00:00 IST) that bills
//                    (stored in UTC) must fall in to belong to the day
const IST_OFFSET_MIN = 330;
const dayStr = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
const todayStr = () => dayStr(new Date());
const closeDateOf = (date: string) => new Date(`${date}T00:00:00.000Z`);
const billWindow = (date: string) => {
  const start = new Date(`${date}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
};

// Sum a day's completed bills by payment method (server-authoritative totals).
async function systemTotalsFor(tenantId: string, date: string) {
  const { start, end } = billWindow(date);
  const bills = await prisma.bill.findMany({
    where: { tenantId, deletedAt: null, status: 'completed', createdAt: { gte: start, lt: end } },
    select: { paymentMethod: true, totalAmount: true },
  });
  let cash = 0, upi = 0, card = 0, credit = 0;
  for (const b of bills) {
    const a = Number(b.totalAmount);
    if (b.paymentMethod === 'upi') upi += a;
    else if (b.paymentMethod === 'card') card += a;
    else if (b.paymentMethod === 'credit') credit += a;
    else cash += a; // cash or unspecified
  }
  return { cash, upi, card, credit, total: cash + upi + card + credit, billCount: bills.length };
}

// Days in the last 30 that had sales but were never closed (before today).
async function pendingDays(tenantId: string): Promise<string[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [bills, closes] = await Promise.all([
    prisma.bill.findMany({ where: { tenantId, deletedAt: null, status: 'completed', createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.dayClose.findMany({ where: { tenantId }, select: { closeDate: true } }),
  ]);
  const withSales = new Set(bills.map((b) => dayStr(b.createdAt)));
  const closed = new Set(closes.map((c) => dayStr(c.closeDate)));
  const today = todayStr();
  return [...withSales].filter((d) => d < today && !closed.has(d)).sort();
}

// Whether today (or a given date) is closed, plus any pending earlier days.
router.get('/status', requirePermission('billing', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const date = (req.query['date'] as string) || todayStr();
    const [close, pending] = await Promise.all([
      prisma.dayClose.findUnique({ where: { tenantId_closeDate: { tenantId: t(req), closeDate: closeDateOf(date) } } }),
      pendingDays(t(req)),
    ]);
    sendSuccess(res, { date, closed: !!close, close, pendingDays: pending });
  } catch (err) { next(err); }
});

// Audit trail — recent day closes.
router.get('/', requirePermission('billing', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.dayClose.findMany({ where: { tenantId: t(req) }, orderBy: { closeDate: 'desc' }, take: 60 });
    sendSuccess(res, { data, total: data.length });
  } catch (err) { next(err); }
});

// Close a day. Idempotency is enforced by the unique (tenant, closeDate) key.
router.post('/', requirePermission('billing', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = req.body as { closeDate?: string; physicalCash?: number; denominations?: unknown; notes?: string };
    const date = b.closeDate || todayStr();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Invalid close date', 422);
    if (date > todayStr()) throw new AppError('Cannot close a future day', 422);

    const closeDate = closeDateOf(date);
    const existing = await prisma.dayClose.findUnique({ where: { tenantId_closeDate: { tenantId: t(req), closeDate } } });
    if (existing) throw new AppError(`${date} has already been closed`, 409);

    const totals = await systemTotalsFor(t(req), date);
    const r2 = (n: number) => Number(n.toFixed(2));
    const physicalCash = r2(Number(b.physicalCash) || 0);

    const close = await prisma.dayClose.create({
      data: {
        tenantId: t(req), closeDate,
        systemCash: r2(totals.cash), systemUpi: r2(totals.upi), systemCard: r2(totals.card), systemCredit: r2(totals.credit),
        systemTotal: r2(totals.total), billCount: totals.billCount,
        physicalCash, variance: r2(physicalCash - totals.cash),
        denominations: (b.denominations ?? undefined) as never, notes: b.notes,
        closedBy: req.user!.sub, closedByName: req.user!.name ?? undefined,
      },
    });

    await createAuditLog({
      tenantId: t(req), userId: req.user!.sub, userName: req.user!.name ?? 'User',
      module: 'billing', action: 'update', entityId: close.id, entityName: `Day close ${date}`,
      description: `Closed ${date}: system cash ₹${totals.cash.toFixed(2)}, physical ₹${physicalCash.toFixed(2)}, variance ₹${(physicalCash - totals.cash).toFixed(2)}`,
      severity: 'critical',
    });

    sendSuccess(res, close, 'Day closed', 201);
  } catch (err) { next(err); }
});

export default router;
