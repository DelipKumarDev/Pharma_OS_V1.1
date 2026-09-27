import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import type { NextFunction, Response } from 'express';
import { config } from './config';
import { prisma } from './config/database';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authenticate } from './middleware/authenticate';
import type { AuthRequest } from './middleware/authenticate';
import { sendSuccess } from './utils/response';
import { sendSms } from './utils/sms';
import { resolveTemplates, renderTemplate } from './utils/template';
import * as vendorService from './modules/vendor/vendor.service';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import medicineRoutes from './modules/medicine/medicine.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import billingRoutes from './modules/billing/billing.routes';
import customerRoutes from './modules/customer/customer.routes';
import vendorRoutes from './modules/vendor/vendor.routes';
import purchaseInvoiceRoutes from './modules/vendor/purchaseInvoice.routes';
import prescriptionRoutes from './modules/prescription/prescription.routes';
import returnsRoutes from './modules/returns/returns.routes';
import userRoutes from './modules/user/user.routes';
import rolesRoutes from './modules/user/roles.routes';
import notificationRoutes from './modules/notification/notification.routes';
import reorderRoutes from './modules/reorder/reorder.routes';
import purchaseOrderRoutes from './modules/purchase-order/purchaseOrder.routes';
import deliveryRoutes from './modules/delivery/delivery.routes';
import transferRoutes from './modules/transfer/transfer.routes';
import dayCloseRoutes from './modules/day-close/day-close.routes';
import auditRoutes from './modules/audit/audit.routes';
import settingsRoutes from './modules/settings/settings.routes';
import reportsRoutes from './modules/reports/reports.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import scheduleRegisterRoutes from './modules/schedule-register/scheduleRegister.routes';
import searchRoutes from './modules/search/search.routes';
import scanRoutes from './modules/scan/scan.routes';

const app = express();

// Behind exactly one reverse proxy (nginx) in production, so req.ip / rate-limit
// keys / audit IPs reflect the real client via X-Forwarded-For. Trust ONE hop
// only — the app is not directly reachable (only nginx is exposed), so a client
// cannot spoof X-Forwarded-For past it.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging
app.use(requestLogger);

// Global rate limiter
app.use('/api', apiLimiter);

// Liveness — process is up (no dependencies checked). Used by container HEALTHCHECK.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Readiness — the app can serve traffic (database reachable). Used by
// orchestrators/load balancers before routing to this instance. 503 when the DB
// is down so a not-ready instance is taken out of rotation.
app.get('/health/ready', async (_req: AuthRequest, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', db: 'up', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not-ready', db: 'down', timestamp: new Date().toISOString() });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase-invoices', purchaseInvoiceRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reorder', reorderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/delivery-orders', deliveryRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/day-close', dayCloseRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/schedule-register', scheduleRegisterRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/scan', scanRoutes);

// Vendor payments
app.post('/api/vendor-payments', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await vendorService.createVendorPayment(req.user!.tenantId, req.body, req.user!.sub);
    sendSuccess(res, payment, 'Payment recorded', 201);
  } catch (err) { next(err); }
});

// Refill reminders
app.get('/api/refills', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const reminders = await prisma.refillReminder.findMany({ where: { tenantId }, orderBy: { dueDate: 'asc' } });
    const overdue = reminders.filter(r => r.status === 'overdue').length;
    const dueToday = reminders.filter(r => r.status === 'due_today').length;
    const dueSoon = reminders.filter(r => r.status === 'due_soon').length;
    sendSuccess(res, { reminders, summary: { overdue, dueToday, dueSoon, total: reminders.length } });
  } catch (err) { next(err); }
});

app.post('/api/refills/:id/remind', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reminder = await prisma.refillReminder.findFirst({
      where: { id: req.params['id']!, tenantId: req.user!.tenantId },
    });
    if (!reminder) { res.status(404).json({ success: false, message: 'Refill reminder not found' }); return; }
    if (!reminder.phone) { res.status(400).json({ success: false, message: 'Customer has no phone number on file' }); return; }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { name: true, messageTemplates: true } });
    const templates = resolveTemplates(tenant?.messageTemplates);
    const message = renderTemplate(templates.refillReminder, {
      customerName: reminder.customerName,
      medicine: reminder.medicine,
      overdue: reminder.daysOverdue > 0 ? ` (${reminder.daysOverdue} days overdue)` : '',
      pharmacyName: tenant?.name ?? 'Your pharmacy',
    });
    const sent = await sendSms(reminder.phone, message);
    sendSuccess(res, { delivered: sent }, sent ? 'Reminder sent via SMS' : 'Reminder queued (SMS provider not configured — logged to console)');
  } catch (err) { next(err); }
});

// 404 & error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
