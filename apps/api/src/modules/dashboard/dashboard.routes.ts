import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const alertDays = tenant?.expiryAlertDays ?? 90;

    const [
      todayBills, yesterdayBills,
      totalMedicines, lowStockCount,
      expiringSoonCount, activeCustomers,
      pendingPrescriptions, pendingReturns,
    ] = await Promise.all([
      prisma.bill.findMany({ where: { tenantId, createdAt: { gte: today }, status: 'completed', deletedAt: null } }),
      prisma.bill.findMany({ where: { tenantId, createdAt: { gte: yesterday, lt: today }, status: 'completed', deletedAt: null } }),
      prisma.medicine.count({ where: { tenantId, status: 'active', deletedAt: null } }),
      prisma.inventoryItem.count({ where: { tenantId, status: 'low_stock', deletedAt: null } }),
      prisma.inventoryItem.count({ where: { tenantId, expiryStatus: 'expiring_soon', deletedAt: null } }),
      prisma.customer.count({ where: { tenantId, status: 'active', deletedAt: null } }),
      prisma.prescription.count({ where: { tenantId, status: 'pending_review', deletedAt: null } }),
      prisma.returnRequest.count({ where: { tenantId, status: 'pending', deletedAt: null } }),
    ]);

    const todayRevenue = todayBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const yesterdayRevenue = yesterdayBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const todayBillsCount = todayBills.length;
    const yesterdayBillsCount = yesterdayBills.length;

    const revenueChange = yesterdayRevenue === 0 ? 0 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    const billsChange = yesterdayBillsCount === 0 ? 0 : ((todayBillsCount - yesterdayBillsCount) / yesterdayBillsCount) * 100;

    // Revenue chart - last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBills = await prisma.bill.findMany({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo }, status: 'completed', deletedAt: null },
      select: { totalAmount: true, createdAt: true },
    });

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
      if (entry) { entry.revenue += bill.totalAmount; entry.bills++; }
    }

    const revenueChart = Array.from(revenueByDate.entries()).map(([date, v]) => ({ date, ...v }));

    // Top medicines by bill items
    const topItems = await prisma.billItem.groupBy({
      by: ['medicineName'],
      where: { bill: { tenantId, createdAt: { gte: thirtyDaysAgo }, deletedAt: null } },
      _sum: { quantity: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    const topMedicines = topItems.map(item => ({
      name: item.medicineName,
      qty: item._sum.quantity ?? 0,
      revenue: item._sum.totalAmount ?? 0,
    }));

    // Sales by category
    const categoryItems = await prisma.billItem.findMany({
      where: { bill: { tenantId, createdAt: { gte: thirtyDaysAgo }, deletedAt: null } },
      include: { medicine: { select: { category: true } } },
    });

    const categoryMap = new Map<string, number>();
    for (const item of categoryItems) {
      const cat = item.medicine?.category ?? 'other';
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + item.totalAmount);
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

    sendSuccess(res, {
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
    });
  } catch (err) { next(err); }
});

export default router;
