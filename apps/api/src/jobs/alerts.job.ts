import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sendAlertEmail } from '../utils/mailer';
import { sendAlertSms } from '../utils/sms';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const BOOT_DELAY_MS = 60 * 1000; // first run 1 min after boot

/** Scans every active tenant for low-stock and near-expiry items, creates in-app
 *  notifications, and sends email/SMS alerts where the tenant has opted in. */
export async function runStockAlerts(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, status: { in: ['active', 'trial'] } },
    select: {
      id: true, name: true, expiryAlertDays: true,
      lowStockAlert: true, expiryAlert: true,
      emailAlerts: true, smsAlerts: true, alertEmail: true, alertPhone: true, email: true,
    },
  });

  for (const tenant of tenants) {
    try {
      const expiryCutoff = new Date(Date.now() + tenant.expiryAlertDays * 86400000);

      const [lowStock, expiring] = await Promise.all([
        tenant.lowStockAlert
          ? prisma.inventoryItem.findMany({
              where: { tenantId: tenant.id, deletedAt: null, status: { in: ['low_stock', 'out_of_stock'] } },
              include: { medicine: { select: { name: true, reorderLevel: true } } },
              take: 100,
            })
          : Promise.resolve([]),
        tenant.expiryAlert
          ? prisma.inventoryItem.findMany({
              where: {
                tenantId: tenant.id, deletedAt: null, quantity: { gt: 0 },
                expiryDate: { lte: expiryCutoff, gte: new Date() },
              },
              include: { medicine: { select: { name: true } } },
              take: 100,
            })
          : Promise.resolve([]),
      ]);

      if (lowStock.length === 0 && expiring.length === 0) continue;

      // In-app notifications (deduplicate: skip if an unread one of same type exists today)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const existingToday = await prisma.notification.findMany({
        where: { tenantId: tenant.id, createdAt: { gte: startOfDay }, type: { in: ['low_stock', 'expiry_alert'] } },
        select: { type: true },
      });
      const alreadySent = new Set(existingToday.map(n => n.type));

      if (lowStock.length > 0 && !alreadySent.has('low_stock')) {
        await prisma.notification.create({
          data: {
            tenantId: tenant.id,
            type: 'low_stock',
            category: 'inventory',
            priority: lowStock.some(i => i.status === 'out_of_stock') ? 'critical' : 'warning',
            title: `${lowStock.length} medicine${lowStock.length !== 1 ? 's' : ''} low on stock`,
            message: lowStock.slice(0, 5).map(i => i.medicine?.name ?? 'Unknown').join(', ') + (lowStock.length > 5 ? '…' : ''),
          },
        });
      }
      if (expiring.length > 0 && !alreadySent.has('expiry_alert')) {
        await prisma.notification.create({
          data: {
            tenantId: tenant.id,
            type: 'expiry_alert',
            category: 'inventory',
            priority: 'warning',
            title: `${expiring.length} batch${expiring.length !== 1 ? 'es' : ''} expiring within ${tenant.expiryAlertDays} days`,
            message: expiring.slice(0, 5).map(i => `${i.medicine?.name ?? 'Unknown'} (${i.batchNumber})`).join(', ') + (expiring.length > 5 ? '…' : ''),
          },
        });
      }

      // Email alerts
      const alertTo = tenant.alertEmail || tenant.email;
      if (tenant.emailAlerts && alertTo) {
        if (lowStock.length > 0) {
          await sendAlertEmail(alertTo, tenant.name, 'low_stock',
            lowStock.map(i => ({ name: i.medicine?.name ?? 'Unknown', detail: `${i.quantity} left (reorder at ${i.medicine?.reorderLevel ?? '-'})` })));
        }
        if (expiring.length > 0) {
          await sendAlertEmail(alertTo, tenant.name, 'expiry',
            expiring.map(i => ({ name: i.medicine?.name ?? 'Unknown', detail: `Batch ${i.batchNumber} expires ${i.expiryDate.toLocaleDateString('en-IN')}` })));
        }
      }

      // SMS alerts (single summary message)
      if (tenant.smsAlerts && tenant.alertPhone) {
        const parts: string[] = [];
        if (lowStock.length > 0) parts.push(`${lowStock.length} low-stock`);
        if (expiring.length > 0) parts.push(`${expiring.length} expiring`);
        await sendAlertSms(tenant.alertPhone, `${tenant.name}: ${parts.join(', ')} items need attention. Open PharmaOS for details.`);
      }

      logger.info(`Alerts processed for ${tenant.name}: ${lowStock.length} low-stock, ${expiring.length} expiring`);
    } catch (err) {
      logger.error(`Alert job failed for tenant ${tenant.id}: ${(err as Error).message}`);
    }
  }
}

export function startAlertScheduler(): void {
  setTimeout(() => {
    void runStockAlerts();
    setInterval(() => void runStockAlerts(), RUN_INTERVAL_MS);
  }, BOOT_DELAY_MS);
  logger.info('Stock/expiry alert scheduler started (daily)');
}
