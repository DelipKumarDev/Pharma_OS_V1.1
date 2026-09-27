import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { getInventoryStats } from '../inventory/inventory.service';

const router = Router();
router.use(authenticate);

// Dashboard KPIs change slowly; a short cache absorbs concurrent load from
// multiple terminals without stale-feeling data (frontend staleTime is 60s).
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { data: unknown; at: number }>();
// Single-flight: concurrent cache-miss requests for the same tenant share one
// computation instead of each running the heavy query (prevents cache stampede).
const inflight = new Map<string, Promise<unknown>>();

async function buildDashboard(tenantId: string): Promise<unknown> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      tenant,
      todayAgg, yesterdayAgg,
      totalMedicines, invStats,
      activeCustomers,
      pendingPrescriptions, pendingReturns,
      recentBills, topItems, categoryItems,
    ] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { expiryAlertDays: true } }),
      prisma.bill.aggregate({
        where: { tenantId, createdAt: { gte: today }, status: 'completed', deletedAt: null },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.bill.aggregate({
        where: { tenantId, createdAt: { gte: yesterday, lt: today }, status: 'completed', deletedAt: null },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.medicine.count({ where: { tenantId, status: 'active', deletedAt: null } }),
      // Single source of truth for stock counts — same computation the Stock
      // page header uses, so the dashboard KPIs always match it (TC_018).
      getInventoryStats(tenantId),
      prisma.customer.count({ where: { tenantId, status: 'active', deletedAt: null } }),
      prisma.prescription.count({ where: { tenantId, status: 'pending_review', deletedAt: null } }),
      prisma.returnRequest.count({ where: { tenantId, status: 'pending', deletedAt: null } }),
      prisma.bill.findMany({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo }, status: 'completed', deletedAt: null },
        select: { totalAmount: true, createdAt: true },
      }),
      prisma.billItem.groupBy({
        by: ['medicineName'],
        where: { bill: { tenantId, createdAt: { gte: thirtyDaysAgo }, deletedAt: null } },
        _sum: { quantity: true, totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5,
      }),
      prisma.billItem.findMany({
        where: { bill: { tenantId, createdAt: { gte: thirtyDaysAgo }, deletedAt: null } },
        select: { totalAmount: true, medicine: { select: { category: true } } },
      }),
    ]);

    const lowStockCount = invStats.lowStockCount;
    const expiringSoonCount = invStats.expiringSoonCount;
    const alertDays = tenant?.expiryAlertDays ?? 90;
    const todayRevenue = Number(todayAgg._sum.totalAmount ?? 0);
    const yesterdayRevenue = Number(yesterdayAgg._sum.totalAmount ?? 0);
    const todayBillsCount = todayAgg._count;
    const yesterdayBillsCount = yesterdayAgg._count;

    const revenueChange = yesterdayRevenue === 0 ? 0 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    const billsChange = yesterdayBillsCount === 0 ? 0 : ((todayBillsCount - yesterdayBillsCount) / yesterdayBillsCount) * 100;

    // Revenue chart - last 30 days
    const revenueByDate = new Map<string, { revenue: number; bills: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split('T')[0]!;
      revenueByDate.set(key, { revenue: 0, bills: 0 });
    }

    for (const bill of recentBills) {
      const key = bill.createdAt.toISOString().split('T')[0]!;
      const entry = revenueByDate.get(key);
      if (entry) { entry.revenue += Number(bill.totalAmount); entry.bills++; }
    }

    const revenueChart = Array.from(revenueByDate.entries()).map(([date, v]) => ({ date, ...v }));

    const topMedicines = topItems.map(item => ({
      name: item.medicineName,
      qty: item._sum.quantity ?? 0,
      revenue: item._sum.totalAmount ?? 0,
    }));

    // Sales by category
    const categoryMap = new Map<string, number>();
    for (const item of categoryItems) {
      const cat = item.medicine?.category ?? 'other';
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Number(item.totalAmount));
    }
    const totalCatRevenue = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
    const salesByCategory = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, value]) => ({ category, value: totalCatRevenue > 0 ? Math.round((value / totalCatRevenue) * 100) : 0 }));

    // Alerts
    const alerts = [];
    if (expiringSoonCount > 0) {
      alerts.push({ id: 'expiry', type: 'expiry', message: `${expiringSoonCount} batches expiring within ${alertDays} days`, severity: 'warning' });
    }
    if (lowStockCount > 0) {
      alerts.push({ id: 'low_stock', type: 'stock', message: `${lowStockCount} medicines below reorder level`, severity: 'error' });
    }

    const data = {
      kpis: {
        todayRevenue, todayBills: todayBillsCount, lowStockItems: lowStockCount,
        expiringItems: expiringSoonCount, totalMedicines, activeCustomers,
        todayRevenueChange: Math.round(revenueChange * 10) / 10,
        todayBillsChange: Math.round(billsChange * 10) / 10,
        pendingPrescriptions, pendingReturns,
      },
      revenueChart,
      topMedicines,
      salesByCategory,
      alerts,
    };

    return data;
}

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const hit = cache.get(tenantId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      sendSuccess(res, hit.data);
      return;
    }

    let p = inflight.get(tenantId);
    if (!p) {
      p = buildDashboard(tenantId)
        .then(data => { cache.set(tenantId, { data, at: Date.now() }); inflight.delete(tenantId); return data; })
        .catch(err => { inflight.delete(tenantId); throw err; });
      inflight.set(tenantId, p);
    }
    sendSuccess(res, await p);
  } catch (err) { next(err); }
});

export default router;
